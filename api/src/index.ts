// index.ts — app entrypoint.
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { casesRouter } from './routes/cases';
import { financialsRouter } from './routes/financials';
import { pool } from './db';
import { handleGoogleLogin, requireAuth, requireRole } from './auth';
import { staffRouter } from './routes/staff';
import { tasksRouter } from './routes/tasks';
import { ah } from './asyncHandler';

dotenv.config();

// Process-level safety net: log and keep the server alive instead of
// crashing on any rejection/exception that somehow still slips through
// asyncHandler.ts's per-route wrapping.
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION (server stayed up):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION (server stayed up):', err);
});

const app = express();
// Restrict to the dashboard's own origin(s) — comma-separated in .env so
// prod/staging frontend URLs can be added without a code change.
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err: any) {
    res.status(503).json({ status: 'db_unreachable', message: err.message });
  }
});

// Auth route is intentionally open — it's how you GET a token.
app.post('/auth/google', handleGoogleLogin);

// Everything else requires a valid staff session.
app.use('/cases', ah(requireAuth), casesRouter);
app.use('/financials', ah(requireAuth), financialsRouter);
app.use('/staff', ah(requireAuth), requireRole('admin'), staffRouter);
app.use('/tasks', ah(requireAuth), tasksRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`vls-dashboard-api listening on :${port}`);
});
