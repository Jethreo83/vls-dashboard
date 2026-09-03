// scripts/provision-staff.ts — one-off CLI to insert a vls.staff_user row.
// Run with: npx ts-node scripts/provision-staff.ts <email> <role>
// This is intentionally NOT an API route yet (no admin UI exists) — direct
// DB write via the owner connection, bypassing vls_app (which has no
// INSERT grant on staff_user by design, see migration 005).
import { unsafeOwnerQuery, pool } from '../src/db';

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role) {
    console.error('Usage: provision-staff.ts <email> <attorney|paralegal|admin>');
    process.exit(1);
  }
  if (!['attorney', 'paralegal', 'admin'].includes(role)) {
    console.error(`Invalid role: ${role}`);
    process.exit(1);
  }
  const row = await unsafeOwnerQuery(async (client) => {
    const result = await client.query(
      `INSERT INTO vls.staff_user (google_email, role, created_by)
       VALUES ($1, $2::vls.staff_role, 'provision-staff-script')
       ON CONFLICT (google_email) DO UPDATE SET role = EXCLUDED.role, active = true
       RETURNING id, google_email, role, active`,
      [email, role]
    );
    return result.rows[0];
  });
  console.log('Provisioned:', row);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
