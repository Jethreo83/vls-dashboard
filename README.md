# VLS Dashboard

Modernized Victory Legal Solutions case management system — replacing the
Google-Sheets-backed Command Center with a proper PostgreSQL data layer,
starting with the VLS schema per ADR-001/ADR-002 (see `docs/HANDOFF_2026-09-02.md`).

## Status

Schema build in progress. Live spec: `docs/HANDOFF_2026-09-02.md`.

## Stack

- **Database:** PostgreSQL via Neon (project `aged-art-92489373`, "Jocasta Dashboard")
- **Migration order:** database → server modularization → frontend (per ADR)
- **Staging:** Neon branch off `production`, never points at live data

## Repo layout

```
migrations/   Numbered SQL migrations, applied in order
scripts/      verify_schema.sh and other operational scripts
docs/         Architecture decisions, domain rules, handoff docs
```

## Domain corrections (post-handoff, confirmed by Jed 2026-09-03)

- Fee-shifting is **not** first-party only. Third-party cases whose cause of
  action supports it (e.g. Chapter 38 contract claims — unpaid repairs) may
  also recover fees. The original domain-rules doc overstated the first-party
  restriction; `case_financial.recoverable` logic must check cause_of_action,
  not just the first/third-party flag.
