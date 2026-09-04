# Overnight Decision Log

Anything below needs Jed's sign-off before it happens. Nothing here has been acted on without approval - check this file when you ping in on Telegram.

Status values: PENDING (waiting on Jed), APPROVED (Jed said yes, now doing it), DECLINED (Jed said no).

## Current queue

- PENDING: shell-dashboard needs the actual Google Workspace domain strings for Complete Collision and Elektrica (only vlslawfirm.com is confirmed) - needed for its login domain->business mapping. Not blocking current build, but needed before that mapping is real.
- PENDING: complete-collision needs your call on whether job.cost totals (gross_revenue, direct_ro_costs, labor_cost, rent_utility_share) should become fully derived from the new itemized collision.cost_entry ledger once itemized entry is standard, or coexist indefinitely (cost_entry for detail, job's columns as the human-confirmed number of record). From migration 006 (still untagged/staging-only, not yet promoted).
- NOTE (not a decision, a process gap): a second, unattended session of the complete-collision bot profile ran concurrently without either session knowing - it built its own migration 006 while I was mid-task with a different 006. No collision damage (correctly caught via git log, files renumbered cleanly, nothing overwritten), but there's currently no way for either session to know the other is running. Worth deciding later whether that matters enough to fix (e.g. a lock file, or just "check git log first" discipline).
- RESOLVED - Elektrica architecture direction: Jed confirmed the v2 claim-generation-machine (Postgres, shared platform.person, JP-litigation reuse) is the real scope, built all night with his approval. The older SQLite/FastAPI CRUD app (commit 4a46d40, accidentally pushed to origin alongside migration 007 - a git-push-carries-the-whole-branch mistake, not a data/security incident, no VLS data or Neon connection involved) is superseded. Bot cleared to remove/archive that track and continue on v2.

## Log

- 2026-09-04: shell-dashboard ADR-001 approved with 5 answered decisions: (1) true SSO, one JWT all dashboard APIs verify directly - not a redirect/exchange-token handoff, (2) Elektrica's door omitted from launcher until it has its own staff_user table (shell bot's own scope-correct proposal), (3) domains for Collision/Elektrica still need confirming with Jed before Decision 4's mapping is built for real, (4) real routing-level entitlement enforcement, not UI-only hiding, (5) accepted VLS's existing tradeoff (stateless 8h JWT, no logout blocklist) rather than building token revocation now - revisit if financials needs harder guarantees later.

- 2026-09-04: SPAWNED new locked bot `shell-dashboard` per Jed's instruction, for the thin login+launcher shell (parallel-build instruction step 2). Repo github.com/Jethreo83/shell-dashboard (public from creation), profile at $LOCALAPPDATA/hermes/profiles/shell-dashboard, model Sonnet 5, memory NOT shared with elektrica-dashboard/complete-collision junction per Jed's explicit choice. First task sent: read shared conventions + VLS's auth pattern, produce an ADR before building.
- 2026-09-04: vls-dashboard, elektrica-dashboard, and complete-collision-dashboard repos all made PUBLIC per Jed's decision, after confirming clean git history (no secrets, no committed .env files, no client data) in all three. Resolves the private-repo access-boundary friction that was blocking complete-collision from reading SHARED_CONVENTIONS.md directly.

- 2026-09-04: complete-collision bot applied migration 001 (collision.customer, collision_app role) to production Neon after Jed's direct confirmation to share the aged-art-92489373 project. Verified via direct query post-apply. Not a pending item - already approved and done, logged here for the audit trail.
- 2026-09-04: found a process gap, not a decision - the shared "staging" Neon branch (same project) is used by all three build tracks (VLS, Elektrica, Complete Collision), and resets by one track wipe another's uncommitted test data on that branch. Elektrica's rental migration verified successfully on staging but the data was gone by the time of a later check - not lost work (migration script/verify script are safely in git), just needs each bot to check staging state before assuming it's still there. No action needed from Jed - process note for the record.
- 2026-09-04: RESOLVED - JP litigation state machine: Jed picked option (a), shared/cross-schema reuse of vls.valid_next_states. Elektrica cleared to proceed.
- 2026-09-04: RESOLVED - Complete Collision receptionist role: Jed says treat it like an admin role (full access, not restricted). Bot cleared to build real permission enforcement now, not just the safe shape.
