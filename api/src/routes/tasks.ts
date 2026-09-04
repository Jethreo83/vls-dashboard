// routes/tasks.ts — task CRUD. Unlike case_event, tasks ARE directly
// updatable (status, priority, assignment) since they're operational
// to-dos, not the legal record.
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { withRole } from '../db';
import { ah } from '../asyncHandler';
import { parseId } from '../validators';

export const tasksRouter = Router();

const createTaskSchema = z.object({
  case_id: z.number().int().positive().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assigned_to: z.number().int().positive().optional(),
  due_date: z.string().optional(), // ISO date
  created_by: z.string().min(1),
});

tasksRouter.post('/', ah(async (req: Request, res: Response) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const b = parsed.data;
  try {
    const row = await withRole('vls_app', async (client) => {
      const result = await client.query(
        `INSERT INTO vls.task
           (case_id, title, description, priority, assigned_to, due_date, created_by)
         VALUES ($1,$2,$3,$4::vls.task_priority,$5,$6,$7)
         RETURNING *`,
        [b.case_id ?? null, b.title, b.description ?? null, b.priority,
         b.assigned_to ?? null, b.due_date ?? null, b.created_by]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  } catch (err: any) {
    res.status(400).json({ error: 'insert_failed', message: err.message });
  }
}));

const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;

tasksRouter.get('/', ah(async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  if (status !== undefined && !TASK_STATUSES.includes(status as any)) {
    return res.status(400).json({ error: 'invalid_status', allowed: TASK_STATUSES });
  }
  let caseId: number | undefined;
  if (req.query.case_id !== undefined) {
    const parsed = parseId(String(req.query.case_id));
    if (parsed === null) return res.status(400).json({ error: 'invalid_case_id' });
    caseId = parsed;
  }
  const rows = await withRole('vls_app', async (client) => {
    let query = `SELECT * FROM vls.task WHERE 1=1`;
    const params: any[] = [];
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}::vls.task_status`;
    }
    if (caseId) {
      params.push(caseId);
      query += ` AND case_id = $${params.length}`;
    }
    query += ` ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, due_date NULLS LAST, id`;
    const result = await client.query(query, params);
    return result.rows;
  });
  res.json(rows);
}));

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assigned_to: z.number().int().positive().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

tasksRouter.patch('/:id', ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid_id' });
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const b = parsed.data;
  const setClauses: string[] = [];
  const params: any[] = [];
  if (b.title !== undefined) { params.push(b.title); setClauses.push(`title = $${params.length}`); }
  if (b.description !== undefined) { params.push(b.description); setClauses.push(`description = $${params.length}`); }
  if (b.status !== undefined) { params.push(b.status); setClauses.push(`status = $${params.length}::vls.task_status`); }
  if (b.priority !== undefined) { params.push(b.priority); setClauses.push(`priority = $${params.length}::vls.task_priority`); }
  if (b.assigned_to !== undefined) { params.push(b.assigned_to); setClauses.push(`assigned_to = $${params.length}`); }
  if (b.due_date !== undefined) { params.push(b.due_date); setClauses.push(`due_date = $${params.length}`); }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'no_fields_to_update' });
  }

  try {
    const row = await withRole('vls_app', async (client) => {
      params.push(id);
      const result = await client.query(
        `UPDATE vls.task SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      return result.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ error: 'update_failed', message: err.message });
  }
}));

tasksRouter.get('/status/overdue', ah(async (_req: Request, res: Response) => {
  const rows = await withRole('vls_app', async (client) => {
    const result = await client.query(`SELECT * FROM vls.overdue_tasks`);
    return result.rows;
  });
  res.json(rows);
}));
