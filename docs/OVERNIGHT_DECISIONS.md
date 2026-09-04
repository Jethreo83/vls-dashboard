# Overnight Decision Log

Anything below needs Jed's sign-off before it happens. Nothing here has been acted on without approval - check this file when you ping in on Telegram.

Status values: PENDING (waiting on Jed), APPROVED (Jed said yes, now doing it), DECLINED (Jed said no).

## Current queue

- PENDING: complete-collision needs Jed's decision on receptionist permission scope for Complete Collision (what a receptionist can see/edit vs manager/owner). Bot is correctly holding off building the role-permission logic itself, but is proceeding on the safe subset (role enum, provisioning table shape) that doesn't require knowing the final boundaries.

## Log

- 2026-09-04: complete-collision bot applied migration 001 (collision.customer, collision_app role) to production Neon after Jed's direct confirmation to share the aged-art-92489373 project. Verified via direct query post-apply. Not a pending item - already approved and done, logged here for the audit trail.
- 2026-09-04: found a process gap, not a decision - the shared "staging" Neon branch (same project) is used by all three build tracks (VLS, Elektrica, Complete Collision), and resets by one track wipe another's uncommitted test data on that branch. Elektrica's rental migration verified successfully on staging but the data was gone by the time of a later check - not lost work (migration script/verify script are safely in git), just needs each bot to check staging state before assuming it's still there. No action needed from Jed - process note for the record.
