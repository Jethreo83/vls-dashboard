// routes/cases.ts — case CRUD + the event-append endpoint. State transitions
// only ever happen through POST /cases/:id/events, mirroring the DB-level
// guarantee from migration 002 (direct writes to current_state are rejected
// by trigger even if a route handler tried).
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { withRole } from '../db';

export const casesRouter = Router();

const createCaseSchema = z.object({
  case_type: z.enum([
    'diminished_value', 'unpaid_repairs', 'rental', 'personal_injury',
    'first_party_bad_faith_dtpa',
  ]),
  cause_of_action: z.enum([
    'negligence', 'dtpa', 'bad_faith', 'contract_chapter_38', 'other_contract',
  ]).optional(),
  is_first_party: z.boolean(),
  court_type: z.enum(['pre_suit', 'jp', 'district']),
  client_person_id: z.number().int().positive().optional(),
  intake_source: z.enum(['adobe', 'jotform', 'manual']).optional(),
  created_by: z.string().min(1),
});

casesRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const b = parsed.data;
  try {
    const row = await withRole('vls_app', async (client) => {
      const result = await client.query(
        `INSERT INTO vls.case
           (case_type, cause_of_action, is_first_party, court_type,
            client_person_id, intake_source, created_by, updated_by)
         VALUES ($1::vls.case_type,$2::vls.cause_of_action,$3,$4::vls.court_type,
                 $5,COALESCE($6::vls.intake_source,'manual'),$7,$7)
         RETURNING id, case_type, cause_of_action, is_first_party,
                   fee_shifting_eligible, court_type, current_state, created_at`,
        [b.case_type, b.cause_of_action ?? null, b.is_first_party, b.court_type,
         b.client_person_id ?? null, b.intake_source ?? null, b.created_by]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  } catch (err: any) {
    res.status(400).json({ error: 'insert_failed', message: err.message });
  }
});

casesRouter.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
  const row = await withRole('vls_app', async (client) => {
    const result = await client.query(
      `SELECT * FROM vls.case WHERE id = $1`, [id]
    );
    return result.rows[0];
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

casesRouter.get('/', async (req: Request, res: Response) => {
  const courtType = typeof req.query.court_type === 'string' ? req.query.court_type : undefined;
  const rows = await withRole('vls_app', async (client) => {
    const result = courtType
      ? await client.query(`SELECT * FROM vls.case WHERE court_type = $1 ORDER BY id`, [courtType])
      : await client.query(`SELECT * FROM vls.case ORDER BY id`);
    return result.rows;
  });
  res.json(rows);
});

// ---------------------------------------------------------------------------
// Events — the ONLY way current_state changes. Body validated against the
// same event_type/case_state enum the DB uses; the DB trigger is the real
// enforcement of sequence validity (JP trap etc), this is just a fast
// client-facing 400 vs. a raw Postgres error for the common invalid-shape
// case.
// ---------------------------------------------------------------------------

const createEventSchema = z.object({
  event_type: z.string().min(1),
  source: z.enum(['manual', 'claims_inbox', 'court_efile', 'system']).default('manual'),
  source_ref: z.string().optional(),
  confirmed: z.boolean().default(true),
  confirmed_by: z.string().optional(),
  notes: z.string().optional(),
  created_by: z.string().min(1),
}).refine((b) => !b.confirmed || !!b.confirmed_by, {
  message: 'confirmed_by is required when confirmed is true',
  path: ['confirmed_by'],
});

casesRouter.post('/:id/events', async (req: Request, res: Response) => {
  const caseId = Number(req.params.id);
  if (!Number.isInteger(caseId)) return res.status(400).json({ error: 'invalid_id' });

  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const b = parsed.data;

  try {
    const row = await withRole('vls_app', async (client) => {
      const result = await client.query(
        `INSERT INTO vls.case_event
           (case_id, event_type, source, source_ref, confirmed, confirmed_by, notes, created_by)
         VALUES ($1,$2::vls.case_state,$3::vls.event_source,$4,$5,$6,$7,$8)
         RETURNING id, case_id, event_type, source, confirmed, created_at`,
        [caseId, b.event_type, b.source, b.source_ref ?? null, b.confirmed,
         b.confirmed_by ?? null, b.notes ?? null, b.created_by]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  } catch (err: any) {
    // Surfaces the DB trigger's own message — e.g. the JP-trap rejection
    // text is more useful to a caller than a generic 400.
    res.status(409).json({ error: 'invalid_transition', message: err.message });
  }
});

casesRouter.get('/:id/events', async (req: Request, res: Response) => {
  const caseId = Number(req.params.id);
  if (!Number.isInteger(caseId)) return res.status(400).json({ error: 'invalid_id' });
  const rows = await withRole('vls_app', async (client) => {
    const result = await client.query(
      `SELECT * FROM vls.case_event WHERE case_id = $1 ORDER BY id`, [caseId]
    );
    return result.rows;
  });
  res.json(rows);
});

// Blocked-cases feed — direct pass-through of the vls.blocked_cases view.
casesRouter.get('/status/blocked', async (_req: Request, res: Response) => {
  const rows = await withRole('vls_app', async (client) => {
    const result = await client.query(`SELECT * FROM vls.blocked_cases`);
    return result.rows;
  });
  res.json(rows);
});
