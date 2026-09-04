# Shared Conventions — every locked domain bot builds against these

Source: `INSTRUCTION_Jocasta_parallel_build_2026-09-03.md` (Jed, via Claude). These are not suggestions — if two bots build the same concept differently, that's the drift Jocasta (hermes) is responsible for catching and correcting. Read this before building anything new in `platform.*` or anything that touches another project's domain.

## The six conventions

1. **Person registry** — `platform.person` stays thin (identity only). Each project owns its own party table keyed by `person_id` (e.g. `vls.client`, `elektrica.renter`, `collision.customer`). RLS per ADR-002: cross-project visibility only through each project's own party table, never a direct grant on `platform.person` beyond what's needed.

2. **Document generator** — ONE shared primitive: `(template_id, template_version, merge_data, attachments[]) -> PDF + generation_log_row`. Every project calls it. No project builds its own document generator, even for something that looks project-specific (rental demand letters, DV reports, marketing captions are all templates through this one thing). Placement: build it once shared conventions require it (i.e. when a second real consumer exists — don't build it inside one project's schema "for now" and plan to move it later).

3. **State-machine engine** — one append-only `case_event` pattern (case/rental/job — same shape). State is always derived from events, never written directly (enforced by trigger + REVOKE, not convention alone). JP court logic lives once, in VLS (`vls.valid_next_states`), and is reused via cross-schema reference by any project that needs it (Elektrica does — see `elektrica.rental.vls_case_id`). Never forked or duplicated.

4. **Communication / inbox bot** — one inbound-match-then-propose primitive. Bots match incoming communication to a claim/RO/case and propose an action. They never auto-file. Used today by Elektrica (claim #) and Collision (RO/claim #).

5. **Payments** — one table shape across projects. `accounting_sync_ref` column reserved (nullable, unused) for a future QuickBooks sync — don't build sync now, just leave the seam.

6. **Bot interface** — any bot-driven write goes through a scoped API key to a proposal endpoint. No allowlist bypass, no localhost trust as an auth substitute. Bots propose; a human confirms. This applies to every domain bot and to the future marketing/SEO bot.

## Phase-two hold (do not build yet)

- Marketing dashboard (posting + SEO) — depends on promoting Collision's existing posting engine into a shared service, not rebuilding it. See `MARKETING_DASHBOARD_HANDOFF_2026-09-03.md`.
- Financials dashboard — Jed-only, walled engine, no bot write access, needs the shell's security boundary finished first.
- Brain console — needs the domain bots to exist first (nothing to monitor yet).
- The shell itself (thin login + role-gated launcher) is phase-two-early: build it once there are multiple dashboards worth launching into, not before.

## How Jocasta (hermes) enforces this

- Before approving a new schema/primitive in any locked bot's plan, check whether it's actually convention #2, #3, #4, or #5 in different clothing. If a bot proposes "just building X inside my own schema for now," ask whether X is one of the six — if so, the answer is reuse/wait, not build-a-second-one.
- Log any detected drift (a bot about to duplicate a shared primitive) in `docs/OVERNIGHT_DECISIONS.md` and resolve before either bot proceeds.
- This file is the durable reference; my own memory holds a compressed pointer to it, not the full text.
