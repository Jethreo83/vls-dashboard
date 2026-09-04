// routes/financials.ts — costs, fee split, and the settlement breakdown
// view that's the highest-rated piece of the old dashboard.
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { withRole } from '../db';
import { ah } from '../asyncHandler';
import { parseId } from '../validators';

export const financialsRouter = Router();

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const createCostSchema = z.object({
  case_id: z.number().int().positive().safe(),
  category: z.enum([
    'medical', 'filing_fee', 'expert_witness', 'deposition', 'mediation',
    'process_serving', 'court_reporter', 'other',
  ]),
  amount: z.number().nonnegative(),
  incurred_date: z.string().regex(ISO_DATE_RE, 'must be YYYY-MM-DD'),
  description: z.string().optional(),
  recoverable: z.boolean().default(false),
  source: z.enum(['manual', 'claims_inbox', 'court_efile', 'system']).default('manual'),
  source_ref: z.string().optional(),
  confirmed: z.boolean().default(true),
  confirmed_by: z.string().optional(),
  created_by: z.string().min(1),
}).refine((b) => !b.confirmed || !!b.confirmed_by, {
  message: 'confirmed_by is required when confirmed is true',
  path: ['confirmed_by'],
});

financialsRouter.post('/costs', ah(async (req: Request, res: Response) => {
  const parsed = createCostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const b = parsed.data;
  try {
    const row = await withRole('vls_app', async (client) => {
      const result = await client.query(
        `INSERT INTO vls.case_cost
           (case_id, category, amount, incurred_date, description, recoverable,
            source, source_ref, confirmed, confirmed_by, created_by)
         VALUES ($1,$2::vls.cost_category,$3,$4,$5,$6,$7::vls.event_source,$8,$9,$10,$11)
         RETURNING *`,
        [b.case_id, b.category, b.amount, b.incurred_date, b.description ?? null,
         b.recoverable, b.source, b.source_ref ?? null, b.confirmed,
         b.confirmed_by ?? null, b.created_by]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  } catch (err: any) {
    // Surfaces the recoverable/fee-shifting-eligible trigger rejection.
    res.status(409).json({ error: 'insert_rejected', message: err.message });
  }
}));

financialsRouter.get('/costs/:caseId', ah(async (req: Request, res: Response) => {
  const caseId = parseId(req.params.caseId);
  if (caseId === null) return res.status(400).json({ error: 'invalid_id' });
  const rows = await withRole('vls_app', async (client) => {
    const result = await client.query(
      `SELECT * FROM vls.case_cost WHERE case_id = $1 ORDER BY incurred_date`, [caseId]
    );
    return result.rows;
  });
  res.json(rows);
}));

const upsertFinancialSchema = z.object({
  gross_recovery: z.number().nonnegative().optional(),
  contingency_pct: z.number().min(0).max(1).optional(),
  fees_sought: z.number().nonnegative().optional(),
  fees_awarded: z.number().nonnegative().optional(),
  updated_by: z.string().min(1),
});

financialsRouter.put('/:caseId', ah(async (req: Request, res: Response) => {
  const caseId = parseId(req.params.caseId);
  if (caseId === null) return res.status(400).json({ error: 'invalid_id' });
  const parsed = upsertFinancialSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const b = parsed.data;
  try {
    const row = await withRole('vls_app', async (client) => {
      const result = await client.query(
        `INSERT INTO vls.case_financial (case_id, gross_recovery, contingency_pct, fees_sought, fees_awarded, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (case_id) DO UPDATE SET
           gross_recovery = COALESCE(EXCLUDED.gross_recovery, vls.case_financial.gross_recovery),
           contingency_pct = COALESCE(EXCLUDED.contingency_pct, vls.case_financial.contingency_pct),
           fees_sought = COALESCE(EXCLUDED.fees_sought, vls.case_financial.fees_sought),
           fees_awarded = COALESCE(EXCLUDED.fees_awarded, vls.case_financial.fees_awarded),
           updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [caseId, b.gross_recovery ?? null, b.contingency_pct ?? null,
         b.fees_sought ?? null, b.fees_awarded ?? null, b.updated_by]
      );
      return result.rows[0];
    });
    res.json(row);
  } catch (err: any) {
    res.status(409).json({ error: 'update_rejected', message: err.message });
  }
}));

// The one-button settlement breakdown — direct pass-through of the view.
financialsRouter.get('/breakdown/:caseId', ah(async (req: Request, res: Response) => {
  const caseId = parseId(req.params.caseId);
  if (caseId === null) return res.status(400).json({ error: 'invalid_id' });
  const row = await withRole('vls_app', async (client) => {
    const result = await client.query(
      `SELECT * FROM vls.settlement_breakdown WHERE case_id = $1`, [caseId]
    );
    return result.rows[0];
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
}));

financialsRouter.get('/unreconciled', ah(async (_req: Request, res: Response) => {
  const rows = await withRole('vls_app', async (client) => {
    const result = await client.query(`SELECT * FROM vls.unreconciled_financials`);
    return result.rows;
  });
  res.json(rows);
}));
