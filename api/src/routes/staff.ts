// routes/staff.ts — admin-only staff visibility. Provisioning itself still
// goes through scripts/provision-staff.ts (no UI yet); this route exists so
// requireRole has a real caller and admins can see who currently has access.
import { Router, Request, Response } from 'express';
import { unsafeOwnerQuery } from '../db';

export const staffRouter = Router();

staffRouter.get('/', async (_req: Request, res: Response) => {
  const rows = await unsafeOwnerQuery(async (client) => {
    const result = await client.query(
      `SELECT id, google_email, role, active, created_at FROM vls.staff_user ORDER BY id`
    );
    return result.rows;
  });
  res.json(rows);
});
