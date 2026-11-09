# Implementation status — 2026-11-09

This describes current source, not production deployment. Historical checks and environment observations are preserved in the [dated implementation archive](archive/2026-11-08-implementation-status.md).

| Area | Implemented source | Verification boundary |
| --- | --- | --- |
| Gameplay | Server-authoritative endless runs, all-plates generation, tier-based ore, scarce picks and four-mistake durability; saved cohorts retain their rules | Human balance and browser/device calibration remain open |
| Ownership | Anonymous Secure/HttpOnly/SameSite cookie, fixed 30-day session, Origin/ownership validation | Production expiry/reconnect behavior needs verification |
| Persistence | Temporary current runs and receipts; compact claimed results; one global totals row; bounded expiry cleanup | Requires migration 0005; no live migration or cleanup performed |
| Transport | WebSockets, prediction, ordered batches and HTTP recovery/fallback | Local automated recovery evidence does not establish deployed performance |
| Ranking | Atomic qualifying nickname claims and bounded live TOP 1000 pages from compact results | New claims can shift pages; old signed cursors restart browsing |
| Presentation | Existing four-language UI, keyboard/touch behavior and Game Over totals | Frontend components unchanged by simplification |
| Tooling | Focused tests, naming/architecture checks, PostgreSQL CI and locked migrations | Benchmark/Preview surveys and routine coverage removed; optional coverage remains |
| Operations | Native Vercel Git deployment, required production check and authenticated daily retention route | Daily cleanup requires deployed configuration plus server-only CRON_SECRET |
| Assets/audio | Existing visuals; optional audio still pending | Licensing/provenance audit remains unresolved |

## Current persistence scope

The final schema after `0005_minimal-storage` has exactly **four application tables**: sessions, runs, leaderboard_entries and global_game_stats. This supersedes the intermediate seven-table design. Terminal transitions immediately discard the puzzle and retain a compact summary for 24 hours. Active payloads expire after seven days without an accepted action. Sessions retain small creation-identity markers for their fixed 30-day lifetime; shared request limits use fixed fields on existing rows.

No action-response, frozen snapshot or separate quota table remains. Daily authenticated cleanup reclaims expired runs/sessions; compact claims and global totals survive. The final migration is incompatible with old code and explicitly guarded against an unattended existing-database build cutover. See [data model and rollout](data-model.md).

Frontend components, dictionaries and localized pages remain unchanged. Existing gameplay cohorts retain their generation/reward policies. On a refreshed Game Over page only the summary remains, with an empty final board.

## Verification

The final four-table model passed all 473 tests (including PostgreSQL and real socket cases), lint, typecheck and production build. The migration suite also verifies explicit cutover preserves existing data/identities without recount. Details are in the simplification plan. No selected Neon database size or production behavior was inspected. No live migration, cleanup or deployment was performed.
