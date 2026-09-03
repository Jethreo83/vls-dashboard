# VLS Dashboard

Modernized Victory Legal Solutions case management system — replacing the
Google-Sheets-backed Command Center with a PostgreSQL data layer.

## Status (as of migration 004)

Database schema core is live in production. **No application/API/frontend
exists yet** — this is the data layer only, built first per ADR-001 to avoid
repeating the 2026-09-01 outage (pretty screens on top of unreliable data).

### Schema

- **`vls.case_event`** — append-only event log. Case state is derived from
  this, never typed directly.
- **`vls.case`** — the case record. `current_state` is a cached read of the
  latest event, enforced by trigger (direct writes blocked). Court-type state
  machines (JP vs District) enforced in `valid_next_states()` — includes the
  JP discovery trap (motion required, not automatic).
- **`vls.case_cost` / `vls.case_financial`** — itemized costs with a
  `recoverable` gate tied to `fee_shifting_eligible`, fee split, and the
  `vls.settlement_breakdown` view (one-query settlement numbers).
- **`platform.person`** — shared identity registry, RLS-isolated per app.
  **`vls.client`** — VLS's own party table; a person is only visible to
  `vls_app` if a `vls.client` row exists for them.

### Fee-shifting rule (corrected 2026-09-03)

First-party claims are always fee-shifting eligible. Third-party claims are
eligible only when the cause of action supports it (e.g. Chapter 38 contract
claims like unpaid repairs). Computed by `vls.compute_fee_shifting_eligible()`,
not hand-set — see `docs/DOMAIN-DECISIONS.md` region in the handoff doc.

## Deploy process

Every migration: write SQL in `migrations/`, apply to the Neon `staging`
branch, run the matching `scripts/verify_NNN.sql` against staging, confirm
results by direct query (not by trusting a clean exit code), reset staging
back to a clean mirror of `production`, then apply to `production`, tag the
commit. See `docs/HANDOFF_2026-09-02.md` (`SKILL_vls-deploy-safety.md`
section) for the full rationale.

```bash
# apply to staging
neon connection-string staging --project-id aged-art-92489373 \
  --database-name neondb --role-name neondb_owner --psql -- -f migrations/00N_x.sql

# verify
neon connection-string staging --project-id aged-art-92489373 \
  --database-name neondb --role-name neondb_owner --psql -- -f scripts/verify_00N.sql

# reset staging clean, then promote
neon branches reset staging --parent
neon connection-string production --project-id aged-art-92489373 \
  --database-name neondb --role-name neondb_owner --psql -- -f migrations/00N_x.sql
```

## Not yet built

- Backend/API server
- Frontend (deliberately last per ADR-001)
- `collision.*` and `elektrica.*` schemas (future migrations, same
  platform.person + RLS pattern)
- Bot agents (paused per decision to build dashboard core first)
