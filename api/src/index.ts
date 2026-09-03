// index.ts — app entrypoint.
import express from 'express';
import * as dotenv from 'dotenv';
import { casesRouter } from './routes/cases';
import { financialsRouter } from './routes/financials';
import { pool } from './db';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err: any) {
    res.status(503).json({ status: 'db_unreachable', message: err.message });
  }
});

app.use('/cases', casesRouter);
app.use('/financials', financialsRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`vls-dashboard-api listening on :${port}`);
});
