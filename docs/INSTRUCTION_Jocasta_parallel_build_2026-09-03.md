# INSTRUCTION — Jocasta: parallel domain build under shared memory

**From:** Jed, via Claude
**Date:** 2026-09-03
**Companions:** VLS handoff (2026-09-02), Elektrica handoff (2026-09-03), Complete Collision handoff (2026-09-03). These carry the domain detail; this document is the *build model* and Jed's answers to the load-bearing questions.

---

## The build model (this is the correction — read first)

- **All bots share one memory layer.** Same pattern already working for the Collision and Elektrica bots and for you and Kay. They are coordinated because they share what they know. There is NO "build the trunk first, everyone waits" step. Parallel from the start.
- **Each bot is locked to one project.** A VLS bot cannot wander into Elektrica's work, etc. Isolation is by project lock, not by sequencing.
- **You own the shared conventions inside that shared memory.** Shared memory keeps bots *coordinated*; it does not by itself keep them *consistent in what they build*. That is your job as integrator. Hold the conventions below in shared memory and hold each bot to them, so the pieces fit when they meet.

### The shared conventions every locked bot builds against (do not let them each reinvent these)
1. **Person registry** — `platform.person` thin; each project owns its party table keyed by `person_id`; RLS per ADR-002. Same shape in every project.
2. **Document generator** — one primitive: `(template_id, template_version, merge_data, attachments[]) -> PDF + generation_log_row`. All projects call it; none writes its own.
3. **State-machine engine** — one append-only `case_event` pattern; state derived from events. JP court logic is shared (VLS uses JP + District; Elektrica uses JP only).
4. **Communication / inbox bot** — one inbound-match-then-propose primitive; used by Elektrica (claim #) and Collision (RO/claim). Propose, never auto-file.
5. **Payments** — one table shape; `accounting_sync_ref` reserved for QuickBooks-later.
6. **Bot interface** — bots write only via scoped API key to proposal endpoints; no allowlist bypass, no localhost trust. Propose; human confirms.

If two bots would build the same concept differently, that is the drift to catch. Consistency is enforced by you, in shared memory, not discovered at integration time.

---

## Step 0 — before spawning anything

Inspect the two existing profiles on your install — `elektrica-dashboard` and `complete-collision` — and report what is in them BEFORE any bot builds. Building next to an unknown prior attempt is how the two-directory mess on the mini happened. Do not touch them until you have reported their state.

---

## Step 1 — spawn one locked bot per live domain, in parallel

VLS, Elektrica, Complete Collision. Each:
- locked to its project, sharing memory, reporting to you
- builds its domain schema and screens **against the six shared conventions**, not its own versions
- freezes work only through your `freeze.sh`; runs its own verify suite; behaviour proven against a live DB
- self-authored tests are flagged as unable to catch domain misunderstandings — Jed checks the Texas-practice and shop-practice parts

## Step 2 — the shell (thin now, filled later)

One login, role-based doors, launcher to each dashboard. **The shell is the security boundary** — a door does not appear unless the logged-in user is entitled to it. Build it thin and early (login + launcher), fill it in as dashboards land. This is what will later protect the financials dashboard.

## Step 3 — HOLD for phase two (do not build yet)

Marketing, financials, and brain-console dashboards. Reasons: marketing depends on the shared posting service (promote Collision's existing engine into it); financials needs the shell's security boundary finished first and must be its own walled engine, Jed-only, no bot write access; brain console needs the other bots existing before it has anything to monitor.

---

## Jed's answers to the load-bearing questions (bake into shared memory)

> Jed to fill these in before spawn. Bots start from fact, not assumption.

1. **VLS fee-shifting on third-party cases** (blocks VLS fixtures + shared engine): __________
2. **Canonical DV generator** (six variants exist; migrate only the real one): __________
3. **Total loss** — mode inside the DV tool, or a separate tool: __________
4. **Carrier fax/email source** when a demand is sent today (no carrier DB found in code): __________
5. **Collision dashboard users** — Jed only, or estimators/techs too (sets the roles model): __________
6. **Collision payments** — own book of record for now, QuickBooks later (yes/no): __________

Deferred, not blocking: manifest/Sheet fill rates, whether Fleet stores vehicle class, scanner vendor, "best content" metric, legacy tabs. Most wait on Google OAuth being restored on the cloud host (the 58-byte client file).

---

## Standing rules (unchanged)
Read-only against production. Verify before reporting done. No client data or secrets in memory files. Propose; Jed holds the promote button.
