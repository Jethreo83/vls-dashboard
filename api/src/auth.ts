// auth.ts — Google Sign-In verification + JWT session issuance/middleware.
//
// Flow: frontend gets a Google ID token via Google Identity Services
// (client-side), POSTs it to /auth/google. We verify the token against
// Google's public keys, confirm the email is @vlslawfirm.com AND has an
// active row in vls.staff_user, then issue our own short-lived JWT that
// carries {staff_user_id, role, email}. All subsequent API calls carry
// that JWT in Authorization: Bearer <token>.
//
// Session store: none — JWTs are stateless and short-lived (see
// SESSION_TTL_SECONDS). No refresh-token rotation yet; re-login via Google
// when it expires. Deliberately simple for v1; revisit if staff complain
// about re-login frequency.
import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { unsafeOwnerQuery } from './db';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const JWT_SECRET_RAW = process.env.JWT_SECRET;
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hour workday session

if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_OAUTH_CLIENT_ID is not set.');
if (!JWT_SECRET_RAW) throw new Error('JWT_SECRET is not set.');
const JWT_SECRET: string = JWT_SECRET_RAW;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface StaffSession {
  staff_user_id: number;
  google_email: string;
  role: 'attorney' | 'paralegal' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: StaffSession;
    }
  }
}

/**
 * POST /auth/google handler. Verifies the Google ID token, looks up
 * staff_user by email (owner-level read — this runs BEFORE we know who the
 * caller is, so there's no vls_app role context to scope RLS against yet;
 * the staff_user table itself has no person-linked RLS policy, only the
 * GRANT SELECT restriction already in migration 005).
 */
export async function handleGoogleLogin(req: Request, res: Response) {
  const { id_token } = req.body ?? {};
  if (typeof id_token !== 'string' || !id_token) {
    return res.status(400).json({ error: 'missing_id_token' });
  }

  let email: string | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    email = payload?.email;
    if (!payload?.email_verified) {
      return res.status(401).json({ error: 'email_not_verified' });
    }
  } catch (err: any) {
    return res.status(401).json({ error: 'invalid_google_token', message: err.message });
  }

  if (!email || !email.endsWith('@vlslawfirm.com')) {
    return res.status(403).json({ error: 'domain_not_allowed' });
  }

  const staffRow = await unsafeOwnerQuery(async (client) => {
    const result = await client.query(
      `SELECT id, google_email, role FROM vls.staff_user
       WHERE google_email = $1 AND active = true`,
      [email]
    );
    return result.rows[0];
  });

  if (!staffRow) {
    return res.status(403).json({
      error: 'not_provisioned',
      message: `No active staff_user row for ${email}. An admin must provision access.`,
      attempted_email: email,
    });
  }

  const session: StaffSession = {
    staff_user_id: Number(staffRow.id),
    google_email: staffRow.google_email,
    role: staffRow.role,
  };

  const token = jwt.sign(session, JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
  res.json({ token, expires_in: SESSION_TTL_SECONDS, staff: session });
}

/**
 * Middleware: requires a valid Bearer JWT, attaches req.staff.
 * Every route under /cases and /financials should use this — enforced by
 * wiring it as router-level middleware in index.ts, not per-route, so a
 * new route can't accidentally ship unauthenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as StaffSession;
    req.staff = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'invalid_or_expired_token', message: err.message });
  }
}

/**
 * Role gate for admin-only actions (e.g. staff provisioning routes, once
 * built). Use AFTER requireAuth.
 */
export function requireRole(...allowed: StaffSession['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.staff) return res.status(401).json({ error: 'missing_token' });
    if (!allowed.includes(req.staff.role)) {
      return res.status(403).json({ error: 'insufficient_role', required: allowed, actual: req.staff.role });
    }
    next();
  };
}
