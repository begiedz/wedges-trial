# PostgreSQL data model — four application tables

The final schema is [schema.ts](../../src/server/db/schema.ts), after migration `0005_minimal-storage`. Drizzle additionally maintains its technical migration journal in its own schema. This document describes source, not confirmation that a live environment was migrated.

## What remains

| Table | Values | Lifetime |
| --- | --- | --- |
| `sessions` | Anonymous ID/token hash, creation/expiry/revocation times; compact accepted-create ID → run ID markers; private eligibility/claim rate counters and window deadlines | Fixed 30 days; removed once expired and no temporary run references it |
| `runs` | ID, owner, version, cohort, status, score/chests, timestamps, create ID and expiry; full `game` JSON only during play; compact `result` only after finish/abandon | Active: seven days after last accepted action. Terminal summary: 24 hours after termination |
| `leaderboard_entries` | Immutable run/owner IDs, nickname, cohort, score, chests, finish/claim time, total moves/mistakes/broken picks; accepted claim action ID and original rank | Durable, including displaced claims so one run cannot claim twice |
| `global_game_stats` | One row: completed/abandoned games, chests, moves, mistakes, broken picks and credited ore; fixed public-page admission counter/window | Durable aggregate; no per-game analytics history |

There is **no** `run_actions`, `leaderboard_snapshots` or `leaderboard_request_budgets` table in the final schema. Limits remain shared across instances using fixed fields on session/global rows. No rate-limit key table, process-local replacement or new hosting service is needed.

## Active game and terminal result

During play, `game` contains current plate positions/rules, starting reset layout, resources, pending reward, chest counters and run counters. Each accepted move updates that one current document. No full-response history is saved.

The terminal transition's database trigger derives a small `result` from authoritative state, then immediately sets `game = NULL`. The result contains chest index, remaining picks, difficulty, credited ore, opened chests, totals and finish time. It contains no plate positions, move rules, reset layout, pending reward or solver metadata. The terminal row is immutable. After 24 hours it cannot be read privately or claimed, even if physical cleanup has not yet run.

The immediate transition response can show the final board already in RAM. A refreshed terminal run returns its summary with an empty board through the existing DTO; frontend components are unchanged. Discarding the final saved lock is intentional.

A nickname claim still validates owner, name, terminal state, current cohort and atomic TOP 1000 cutoff. The database copies compact result fields into the entry, overriding supplied score fields. After the temporary source result expires, the leaderboard entry remains rankable independently. Expired/unclaimed results have no durable public entry.

## Retry protection without response records

Every existing-run action carries its original expected version. Two actions at one version cannot both commit. Unknown move/reset/continue/abandon outcomes retry unchanged; a stale retry returns 409 and reloads current state. No old intent is silently applied against a newer version. Exact historical response replay is intentionally retired.

Creation has no existing run version, so sessions keep only accepted action/run UUID pairs. A repeated create returns the retained current run. If that run has expired or been deleted, its marker returns not-found instead of creating another game. Markers outlive temporary payloads until the fixed session expires; no score, puzzle or response is stored in them. Their size grows with games started within that session, not moves or chests.

Accepted nickname claims keep the action ID and accepted rank on the compact entry. Exact same action/name retries recover the accepted entry while the source summary is available; changed use of a recorded claim action ID conflicts. A rejected qualification is evaluated again on retry rather than recorded as a permanent historical outcome. One-claim identity remains durable after summary expiry.

## Global totals and limits

One bigint aggregate row counts a run once when it enters finished/abandoned. The update shares the finalization transaction, including rollback; reads, retries and payload deletion do not add or subtract totals. Expired unfinished games are excluded. Migration 0004 initialized counters from then-retained terminal runs; migration 0005 preserves those totals without recounting. Already-deleted historical games cannot be reconstructed.

Private eligibility/claim fixed-window counters are on the authenticated session. The shared public-page counter is on the singleton global row. Admission is one atomic committed statement before service work; rejection still returns 429/Retry-After. Windows reset on admission after expiry. These fixed fields need no record-reclamation job. Future public stats serialization must handle bigint explicitly. No stats UI/API is added.

## Physical cleanup

Reads and mutations enforce run/session expiry immediately. The authenticated daily cron only reclaims expired rows physically. It locks up to 100 owners first with SKIP LOCKED, matching gameplay, and deletes up to 100 expired runs per owner. Expired/revoked owners' runs also become eligible. Empty expired owners are removed; live owners retain create markers. Claimed entries and global totals survive. Failure rolls the deletion transaction back; overlapping invocations skip busy owners.

`vercel.json` contains only the daily 03:00 UTC invocation of `/api/maintenance/cleanup`; dashboard Build Command is not overridden. Configure a strong server-only `CRON_SECRET` after cutover. The route fails closed without that secret and checks the bearer credential before database work. Bounded scheduling is not an immediate deletion-at-deadline guarantee.

## Migration and controlled cutover

`0005_minimal-storage` preserves compact leaderboard claims, accepted create/claim identities and active quota windows before removing the three old tables. It strips all retained terminal puzzles and assigns seven-day active / 24-hour terminal expiry from their last update. Older temporary games/results can therefore expire immediately. It does not change scores, generator cohorts or global totals.

This is a deliberate incompatible cutover. A normal migration command refuses an existing legacy database with `STORAGE_CUTOVER_REQUIRED`, preventing `pnpm db:migrate && pnpm build` from deleting old-app dependencies during an ordinary autodeploy. Fresh databases need no cutover flag. Subsequent migrations after 0005 is already applied work normally.

For an existing database: back it up, stop old writers and automatic cleanup, prepare/build the new release, then run `STORAGE_CUTOVER=1 pnpm db:migrate` against the explicitly selected database during the switch to the new application. Do not set that flag permanently for unattended builds. Enable the authenticated daily cleanup only after new readers/writers are serving. Development can use the same explicit flag on its selected disposable/development database.

After this migration, old action-history readers/writers and old full-terminal-game readers are incompatible. Rollback requires the matching database backup, or retaining the new compact/version-recovery code. A source revert cannot restore discarded puzzles/response histories. No live migration, cleanup, environment-secret change or deployment was performed while implementing this change.
