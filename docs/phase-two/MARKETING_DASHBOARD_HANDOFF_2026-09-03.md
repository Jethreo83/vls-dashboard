# MARKETING DASHBOARD HANDOFF — 2026-09-03

**From:** Jed, via Claude
**For:** Jocasta (integrator) and the marketing bot she spawns
**Build model:** same as the domain bots — spawn one bot **locked to a `marketing` project, sharing memory, reporting to Jocasta**, built against the six shared conventions. This is a phase-two dashboard but it is spec'd now while fresh. Financials and brain-console remain phase two and are noted at the end, not built here.

Scope: **Elektrica and Complete Collision now. VLS later** — leave room, do not build it.

---

## The one instruction that matters most

**Do NOT rebuild posting. Promote it.** Complete Collision already has a working posting engine (Kay 007): `/api/cc/marketing/generate` (OpenAI captions), `/api/cc/marketing/post` (async job + poll, plate-blur, multi-platform), Creatomate video render. This handoff **lifts that engine out of Collision into a shared marketing service** that both Collision and Elektrica call. Building a second posting stack is the failure mode.

Currently working: Facebook (page token), Instagram (same app), Google Business (OAuth), website gallery (`cc_gallery.json`). Not proven: **TikTok** (configured, unverified), **X** (single ref, likely unwired).

---

## 1. What the dashboard is

Two halves, one project:
1. **Posting** — compose/select content (incl. video), post to platforms, per business (Elektrica, Collision).
2. **SEO** — a daily bot on the existing SE Ranking connection that analyses rankings, posts, and site changes and **proposes** actions.

Runs behind the shell, its own engine, isolated per ADR-001.

## 2. The SEO bot — propose, never act

- Runs on the **SE Ranking connection Jed already pays for** — real data day one.
- Daily pass: pull rankings; correlate with posts that went out and how they performed; detect website changes.
- Output is **proposals Jed approves**, e.g. "Collision paint-correction page dropped 6 spots — suggested title/meta change" or "these three keywords slipped, here's suggested content." Automatic *analysis*; human-confirmed *action*.
- Writes only via scoped API key to proposal endpoints. No allowlist bypass. (Shared convention 6.)
- Nothing is published or edited on a live site without Jed's confirm.

## 3. Posting — platform promotion, one at a time

- **Generate-and-queue-for-one-click first.** The bot drafts caption + assembles media; Jed ships with one click.
- A platform becomes **true one-button only once stable.** Facebook / Instagram / Google Business / website are close (already working) and can promote first. **TikTok and X stay "generate + copy" until each is proven and must not block the rest.**
- Every generated post and every send is logged (channel, timestamp, platform response) — same `outbound_log` shape as the demand/appraisal generators. This is the shared **document generator** (convention 2) with social templates, not a new thing.
- Content is pulled from the existing **content library** (Collision's `content_manifest.json`, 22 fields incl. `ro_number`, `uploader`) — promote that into the shared service too so Elektrica can use it. Do not build a second library.
- Video stays on **Creatomate**; move its webhook target to the marketing service's own endpoint (currently points at `kay.elektricarentals.com`).

## 4. Shared conventions this bot must obey (from the parallel-build instruction)

- **Person/business scoping** — posts and SEO data are tagged by business; RLS so each surfaces correctly.
- **Document generator** — social posts are templates through the one generator.
- **Communication/log** — every outbound post logged like every other outbound artifact.
- **Bot interface** — scoped API key, proposal endpoints, propose-then-confirm.
- Jocasta holds these in shared memory so the marketing bot builds them the same way the domain bots do; it does not invent its own.

## 5. Build order

1. Jocasta spawns the marketing bot, locked, sharing memory.
2. Promote Collision's posting engine + content library into a shared marketing service (Elektrica as second consumer).
3. Wire the SEO bot to SE Ranking; daily analysis -> proposals view.
4. Posting UI with generate + one-click for the working platforms; TikTok/X as generate-and-copy.
5. Add Elektrica as a posting source.
6. VLS: leave a seam, do not build.

## 6. Open items (non-blocking; resolve as they surface)
- OpenAI key must be set in the environment (caption generator was down because it was unset while a literal sat in source). Assumed handled with the other operational items.
- TikTok/X promotion criteria: define "stable" before promoting (e.g. N successful manual posts).
- "Best content" ranking (who shoots the best) needs an engagement signal — pull post performance back from platforms in a later pass; manual rating until then.

---

## Phase two — noted, NOT built here

- **Financials dashboard** — Jed-only, its own walled engine, **no bot write access**, built after the shell's security boundary is finished. Manual entry of obligations + required income, per business and personal. Its privacy bar is why it is not in the marketing project.
- **Brain console** — one pane for all agents (Kay, Jocasta, domain bots, marketing bot): alive/last-success, model cost, connection health, a "broken / needs you" panel. Build the health board first, the animated bot-to-bot view second. Needs the other bots to exist first, and is the natural landing view on the shell.
