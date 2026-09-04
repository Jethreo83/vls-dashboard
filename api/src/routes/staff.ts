// routes/staff.ts — admin-only staff visibility + provisioning. Kept
// separate from every other route: this is the one place where an HTTP
// call can grant someone admin access to the whole system, so every
// handler here is requireRole('admin') and nothing here is reachable any
// other way.
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { unsafeOwnerQuery } from '../db';
import { ah } from '../asyncHandler';
import { parseId } from '../validators';

export const staffRouter = Router();

staffRouter.get('/', ah(async (_req: Request, res: Response) => {
  const rows = await unsafeOwnerQuery(async (client) => {
    const result = await client.query(
      `SELECT id, google_email, role, active, created_at FROM vls.staff_user ORDER BY id`
    );
    return result.rows;
  });
  res.json(rows);
}));

const provisionSchema = z.object({
  google_email: z.string().email(),
  role: z.enum(['attorney', 'paralegal', 'admin']),
});

// Mirrors scripts/provision-staff.ts exactly (same query, same
// ON CONFLICT upsert-and-reactivate behavior) so the CLI script and this
// route can never silently diverge in what "provisioning" means.
staffRouter.post('/', ah(async (req: Request, res: Response) => {
  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const { google_email, role } = parsed.data;
  const actingAdmin = req.staff?.google_email ?? 'unknown_admin';
  try {
    const row = await unsafeOwnerQuery(async (client) => {
      const result = await client.query(
        `INSERT INTO vls.staff_user (google_email, role, created_by)
         VALUES ($1, $2::vls.staff_role, $3)
         ON CONFLICT (google_email) DO UPDATE SET role = EXCLUDED.role, active = true
         RETURNING id, google_email, role, active, created_at`,
        [google_email, role, actingAdmin]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  } catch (err: any) {
    // Surfaces the DB's own domain-restriction constraint (found live:
    // this route had no try/catch at all, so a rejected insert leaked a
    // raw 500 with the DB's constraint name instead of a clean 400).
    res.status(400).json({ error: 'provision_rejected', message: err.message });
  }
}));

const deactivateSchema = z.object({
  active: z.boolean(),
});

// Deactivate (or reactivate) — never a hard DELETE. Staff history stays
// intact (case_event.created_by references stay valid) and this can't be
// used to erase who did what.
staffRouter.patch('/:id', ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid_id' });
  const parsed = deactivateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  // Guard against self-lockout: an admin deactivating their own account
  // via a direct API call (bypassing the frontend's confirm dialog) would
  // leave them unable to reactivate themselves or anyone else.
  if (!parsed.data.active && req.staff?.staff_user_id === id) {
    return res.status(400).json({ error: 'cannot_deactivate_self' });
  }

  const row = await unsafeOwnerQuery(async (client) => {
    const result = await client.query(
      `UPDATE vls.staff_user SET active = $1 WHERE id = $2
       RETURNING id, google_email, role, active`,
      [parsed.data.active, id]
    );
    return result.rows[0];
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
}));
