// Verifies requireAuth/requireRole behavior without a live Google login —
// crafts JWTs with the same secret the running server uses and checks
// middleware behavior directly.
//
// IMPORTANT: as of the live-DB-check hardening pass, requireAuth now
// re-queries vls.staff_user by staff_user_id on every request, so these
// crafted tokens only work if that ID actually exists (and is active) in
// whatever DB the API is currently pointed at. staging gets reset often
// by other build tracks — check `SELECT id, google_email, active FROM
// vls.staff_user` first if these tokens start getting account_deactivated
// instead of a real response.
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error('JWT_SECRET not set — run against the api/.env used by the server');

const validSession = { staff_user_id: 1, google_email: 'test@vlslawfirm.com', role: 'admin' };
const paralegalSession = { staff_user_id: 2, google_email: 'paralegal@vlslawfirm.com', role: 'paralegal' };
const validToken = jwt.sign(validSession, JWT_SECRET, { expiresIn: 3600 });
const paralegalToken = jwt.sign(paralegalSession, JWT_SECRET, { expiresIn: 3600 });
const expiredToken = jwt.sign(validSession, JWT_SECRET, { expiresIn: -10 });
const wrongSecretToken = jwt.sign(validSession, 'wrong-secret-entirely', { expiresIn: 3600 });

console.log('VALID_TOKEN=' + validToken);
console.log('PARALEGAL_TOKEN=' + paralegalToken);
console.log('EXPIRED_TOKEN=' + expiredToken);
console.log('WRONG_SECRET_TOKEN=' + wrongSecretToken);
