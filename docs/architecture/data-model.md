# PostgreSQL data model

The implemented schema is [src/server/db/schema.ts](../../src/server/db/schema.ts). Versioned SQL, journal and snapshots are committed under drizzle/. The configured development Neon database has been migrated; other environments require an explicit migration step. See [setup](server-setup.md).

## Implemented tables

| Table | Stored fields and constraints |
| --- | --- |
| sessions | UUID primary key, unique SHA-256 token_hash, expires_at, nullable revoked_at and created_at. The raw 256-bit bearer token exists only in the cookie. |
| runs | UUID primary key, owner_id foreign key to sessions, positive version, checked status, ruleset_version, typed game JSONB, created_at/updated_at. Partial unique index permits only one playing/chest_opened run per owner. Resource/chest bounds, metric presence/nonnegativity and lock objects are checked. Generated ore_nuggets/opened_chests columns and trigger-maintained finished_at support the per-ruleset ranking index. Terminal rows reject updates. |
| run_actions | Composite primary key (owner_id, action_id), run_id foreign key, request fingerprint, original response JSONB, checked successful HTTP status code and created_at. A composite FK ensures the action owner owns its run. IDs are unique across creation and mutations for an owner. |

The game document contains current RunState, initial lock, pending reward, opened-chest count, per-chest and run-total moves/invalidMoves/brokenPicks, and finishedAt. Generated current/initial locks optionally store a verified `optimalMoves` count, never a solver path; null/absent marks an unavailable optimum. Public DTOs omit the initial lock, internal owner/session fields and solver metadata; public movement rules support visual prediction.

| leaderboard_entries | run_id primary key/FK, nickname and claimed_at. Claims require a finished run and reject updates/deletes. Nicknames are trimmed, 1–24 PostgreSQL characters, without control characters; duplicate names and multiple finished runs per owner are allowed. |

## Transactions and recovery

Mutations lock the owner session row, recheck expiry, authorize the run and check replay before version/status. Run changes and original responses commit together. Batched WebSocket moves preserve individual action records and versions within one transaction. Finished/abandoned gameplay is immutable; reading it does not resume an active run.

No browser save is imported. No automatic cleanup is scheduled. The manual `cleanupExpiredRuns()` transaction is described below. Expiry and revocation are checked again under the mutation owner lock.

## Ranking storage and reads (#31)

`leaderboard_entries` contains labels only. `readTopRuns()` joins claims to immutable finished runs, filters the main `deterministic-ore-v1` ranking, orders ore DESC, opened chests DESC, finished_at ASC, UUID ASC and limits to 1000. Displaced claims remain durable. Generated numeric columns derive exclusively from game JSONB; the run trigger derives the indexed timestamp from game.finishedAt. No caller-supplied score is stored in a claim. Private claims reuse run_actions JSONB with additional entry/qualification fields; this is a TypeScript extension, with no SQL migration or rewrite of historical replies.

The private claim service (#33) now combines ownership, Origin, nickname normalization, shared action replay and the atomic cutoff recheck before insertion. Public read/cursor infrastructure is implemented under #24 in `leaderboard_snapshots`. Database constraints enforce finished status and one claim per run, but do not independently enforce TOP 1000 qualification. See [competitive ranking](competitive-ranking.md).

## Public ranking snapshots (#24)

Migration `0002_graceful_wolfpack.sql` adds `leaderboard_snapshots`: random UUID, ruleset, server-only per-snapshot cursor signing key, bounded public entry JSONB and indexed expiry. Snapshot creation reads TOP 1000 in one SQL statement; rows, labels and ranks are frozen even if an earlier-timestamped claim commits later. No session/game/solver data is stored in snapshots. Claims and source scores remain immutable and authoritative; snapshot data is only a short-lived public projection.

Snapshots live for 15 minutes by the database clock. New cursorless reads delete up to 100 expired snapshots using `FOR UPDATE SKIP LOCKED`; deletion and optional new snapshot insertion share a transaction, so an insertion failure rolls cleanup back. Continuations read only a live snapshot from the active ruleset and verify the signed offset. Empty/single-page results need no stored snapshot. Expired records may remain until another cursorless read; no background cleanup is scheduled. Distributed rate/storage limits remain #43 release work.

Apply migrations with `pnpm db:migrate` against the explicitly selected development/Preview database before enabling the endpoint. Test fresh and upgrade paths first. This task applies no remote migrations. Roll back application code while retaining the additive table and all durable claims/results; snapshots expire naturally. No score, cohort or historical data rewrite is required.

## Conservative retention policy (#31)

`src/server/db/retention.ts` exports manual maintenance; requests and builds never call it. All replay IDs and runs remain while their session is live, so a forgotten action ID cannot be reused. Eligible submission is preserved for the entire live owning session; cleanup adds no earlier claim deadline. Expired/revoked credentials cannot submit or retry.

After ownership access ends, an unclaimed finished/abandoned run may be removed only when updated_at and every action's created_at are older than 30 days. Active runs are always retained, even under expired owners. Claimed runs, displaced claims and their owner records survive indefinitely. Sessions are removed only when expired/revoked and no run or action references them. Existing replay rows receive migration-time created_at, granting a full grace period rather than guessing their age.

Maintenance locks up to 100 expired/revoked owners with FOR UPDATE SKIP LOCKED, matching gameplay's first lock, and removes at most 100 runs per selected owner. Actions and terminal runs are deleted in the same transaction; failure rolls both back. There is no automatic replay pruning, scheduler, active-run expiry or production cleanup authorization. Owner selection skips records with only protected runs so they cannot starve eligible cleanup work. Operators should monitor backlog before scheduling this helper at scale.

## Migration and rollback

Apply committed migrations in order using `pnpm db:migrate` against an explicitly selected nonproduction direct connection first. Migration 0001 backfills finished timestamps and introduces checks, indexes, revocation, claims and custom PL/pgSQL triggers; keep those custom SQL statements when generating later migrations. An invalid legacy document aborts migration rather than silently changing score. The original 0000 migration is unchanged.

Rollback the application while retaining the additive schema and data. Do not drop claims, generated projections or replay timestamps as part of an application rollback. A schema rollback requires stopping writes and reviewing a separate data-preserving migration. No production migration or deployment is implied by local tests.

## Issue #31 acceptance evidence — 2026-11-03

| Criterion | Status | Evidence |
| --- | --- | --- |
| Reproducible migrations, checked constraints, no name before play | PASS | Fresh `pnpm db:migrate` and immediate rerun succeeded in disposable PostgreSQL 17. Integration tests upgrade a legacy finished run and reject missing/negative metrics/resources, duplicate active runs, invalid claim names and foreign-owner action references. Anonymous bootstrap/create tests require no nickname. `pnpm db:generate` reports no schema drift. |
| Multiple finished runs for one anonymous session | PASS | PostgreSQL test inserts and claims two finished runs for the same owner with the same nickname. |
| One claim per run; retention/replay and safe cleanup | PASS | Concurrent duplicate inserts commit once; terminal updates and claim deletion fail. Cleanup tests retain live recovery, recent replay records, active/recent runs and durable claims, serialize concurrent maintenance and roll back replay deletion on failure. Existing creation/move replay, ownership, conflict, refresh and rollback tests still pass. |
| No gameplay browser storage | PASS | Existing session controller/prediction tests pass; source search for `localStorage` / `sessionStorage` returns no matches in src. No client persistence changes were introduced. |

Verification: all 159 tests passed with TEST_DATABASE_URL pointing only to disposable local PostgreSQL; `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm build` passed. Lint retains the existing cursor `!important` warning. Tests and build ran outside the sandbox after restricted network/build attempts failed or stalled. The local test container was removed afterward. No remote migration, cleanup, deployment or GitHub issue mutation was performed.

## Statistics compatibility (#49)

No new SQL migration or backfill is required: migration 0001 already checks the existing chest/run counters in game JSONB. `RunState` and pure function signatures remain unchanged; counters stay in the server `StoredGame` wrapper. Generated `LockState` documents now include optional `optimalMoves: number | null`, a count for the initial layout. Existing documents omit it and remain valid; do not retroactively infer an optimum. The same field is cloned to initialLock and retained through reset, moves and persistence, but excluded from public snapshots.

Fresh finished snapshots add `result.totalMetrics` derived from the immutable stored totals. Legacy persisted replay responses remain byte-for-byte compatible at the JSON level and can omit this field; the client validates present counters and displays unavailable statistics when absent. Fresh by-ID reads of old finished runs supply their existing stored totals. An application rollback can leave the additive metadata in JSONB; older readers ignore it. No data rewrite, production migration or deployment is part of #49. The scoring ruleset stays deterministic-ore-v1.

## Pre-release progression/durability update (#61)

The main ranking uses `deterministic-ore-v1`; gameplay uses the 4–7-plate progression and four-mistake durability. This pre-release update requires no SQL schema migration or stored document rewrite. Ranking tie order and reward formulas remain unchanged.
