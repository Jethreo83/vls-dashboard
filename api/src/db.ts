// db.ts — connection pool + per-request role enforcement.
//
// ARCHITECTURE DECISION: every request runs its query inside a transaction
// that does `SET LOCAL ROLE vls_app` (or platform_identity_service for the
// one internal identity-matching path) before touching the database. This
// is what makes migration 004's RLS policies actually bind at the
// application layer — connecting as the pool owner (neondb_owner) and never
// switching role would silently bypass RLS entirely, since FORCE ROW LEVEL
// SECURITY still exempts a superuser/owner-with-BYPASSRLS in some contexts,
// and neondb_owner in this project effectively owns the tables it created.
//
// Trade-off argued in writing (per Jed's ADR preference):
//   Alternative considered: separate connection pools authenticated
//   directly as vls_app / platform_identity_service (real Postgres login
//   roles with passwords), no role-switching needed.
//   - PRO of the alternative: simpler mental model, no per-request SET
//     LOCAL ROLE, can't forget to switch.
//   - CON of the alternative: Neon's serverless driver / pooler charges a
//     new connection-establishment cost per distinct role identity, and
//     managing N sets of role credentials (one per Postgres role) in the
//     API's own secrets is another credential surface to rotate and leak.
//   - PRO of what we built (single pool, SET LOCAL ROLE per transaction):
//     one connection pool, one set of pool credentials, RLS still enforced
//     per-request because SET LOCAL is transaction-scoped and cannot leak
//     across pooled connections between requests.
//   - CON of what we built: a programmer error that forgets to wrap a
//     query in withRole() bypasses RLS silently, running as the owner role.
//     Mitigated by making `query()` (owner-level, no role) a deliberately
//     separate, differently-named function from `withRole()`, so using the
//     unsafe path requires an explicit, visible choice — not the default.
import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. See .env.example.');
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: true },
  max: 10,
});

export type AppRole = 'vls_app' | 'platform_identity_service';

/**
 * Run `fn` inside a transaction with the given Postgres role set for the
 * duration of that transaction only (SET LOCAL). This is the ONLY sanctioned
 * way application route handlers should touch the database.
 */
export async function withRole<T>(
  role: AppRole,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Role name is a fixed enum value, never user input — safe to inline.
    await client.query(`SET LOCAL ROLE ${role}`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Deliberately separate, deliberately unsafe-by-default name: runs as the
 * pool's connection identity (neondb_owner), bypassing RLS. Use ONLY for
 * migrations, admin scripts, or health checks — never in a request handler
 * that touches person/case data.
 */
export async function unsafeOwnerQuery<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
