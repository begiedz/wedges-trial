# Backend and transport

Gameplay is implemented in one Next.js application on Vercel, using Neon PostgreSQL, Drizzle and the pg driver. [Deployment evidence](status.md) is tracked separately from implementation. The [API contract](api-contract.md) defines wire shapes and retry rules; public leaderboard reads remain planned.

## Layers

| Layer | Responsibility |
| --- | --- |
| src/app/api/ | Thin HTTP handlers and authenticated WebSocket upgrade |
| src/server/game/ | Validation, ownership, transitions, batching, transactions and safe diagnostics |
| src/server/db/ | Drizzle schema, pg pool and Vercel pool lifecycle integration |
| src/game/ | Pure puzzle rules, generation and reward calculations |
| src/client/game/ | HTTP validation, session orchestration, socket transport, ordered queue and pure prediction |
| src/features/gameplay/ | Controls, session hook and dialogs |

## Implemented endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/players/session | Bootstrap/restore anonymous session; exact body {} |
| POST | /api/runs | Create run; body contains actionId |
| GET | /api/runs/current | Active owned run or null |
| GET | /api/runs/:id | Owned run, including terminal result |
| POST | /api/runs/:id/move | actionId, expectedVersion, pinId, direction |
| POST | /api/runs/:id/reset | Restore positions, preserve damage and penalties |
| POST | /api/runs/:id/continue | Credit pending reward once and generate next chest |
| POST | /api/runs/:id/abandon | End active run, discard pending reward |
| GET | /api/runs/:id/leaderboard-eligibility | Owned qualification snapshot; no reservation |
| POST | /api/runs/:id/leaderboard-entry | Owned, validated, retry-safe nickname claim; atomic cutoff recheck |
| GET (upgrade) | /api/game/socket?run=:id | Authenticated same-origin WebSocket bound to one owned run |

Reset/continue/abandon bodies contain only actionId and expectedVersion. Strict schemas reject client state and scores. All private responses use no-store. Session bootstrap, lifecycle and recovery use HTTP; the client sends rapid moves over WebSocket, with queued HTTP fallback when upgrade is unavailable. Lifecycle controls wait for pending moves to settle.

## Atomic actions

Each mutation uses a PostgreSQL transaction and locks the session row with FOR UPDATE. After ownership/expiry checks, an exact replay is returned before checking the current version/status. Reusing an action ID with a different fingerprint fails. Accepted actions update state, metrics, version and original replay response atomically; errors roll back.

WebSocket input is ordered and adjacent moves can be coalesced (up to 32) into one transaction. Each accepted move still increments version and metrics once and has its own replay record/result. The final run is written once per batch; replies follow commit. Unexpected persistence failure rolls back the whole batch. Database state, rather than a socket-local map, coordinates tabs and function instances.

The client predicts pin movement and damage immediately. Resources, rewards, terminal status and dialogs follow committed snapshots. Reconnect retries unknown actions with their original IDs/versions; stale-version conflicts clear queued predictions and refetch the owned run. Prediction never supplies trusted state.

## Ranking integration

Private eligibility and claim endpoints are implemented under #33. They use the gameplay cookie, live owner lock and action replay namespace; claims serialize across owners with a cohort advisory transaction lock before querying the bounded TOP 100. Claim and replay insertion commit atomically. See the [claim contract](api-contract.md#post-run-arcade-claims-implemented-under-33). No profile is created and nicknames are labels only.

Public `/api/leaderboard` reads, snapshot pagination and nickname UI remain #24/#34/#46 work. Pure ordering/qualification (#51), claim storage and internal bounded reads (#31) underpin the private service.

## Terminal results and eligibility (#39)

The final pick's third invalid move sets `finished` and `game.finishedAt`, increments final counters, and persists the run together with its original action response. The timestamp is assigned once by the server, not by an eligibility read or claim. Credited ore, opened chests and total metrics form the safe terminal result; pending rewards are never supplied by the caller. The database freezes terminal rows and derives indexed score/timestamp projections from the stored game.

Exact final-action retries return the original response before version/status checks, including after refresh. A new move/reset/continue/abandon action against a finished run returns a conflict; socket batches use the same guards. Finished and abandoned runs are absent from the current-active-run lookup but remain readable by their owner while the session is valid.

The owner may query `/api/runs/:id/leaderboard-eligibility` after finish. This server-derived snapshot does not reserve a place or publish a score. Only accepted nickname claims enter ranking reads, and submission rechecks the current cutoff atomically. Playing, chest-opened and abandoned runs cannot qualify. Public ranking pagination and nickname presentation remain separate work; no first-visit name is required.

Results and action replays remain available throughout the live owning session, with no earlier claim deadline. After session expiry/revocation, private access ends; manual cleanup may remove unclaimed terminal runs only after the run and all its actions pass the 30-day grace period. Claims, including displaced claims, remain durable. See [retention](data-model.md#conservative-retention-policy-31).

### Issue #39 acceptance evidence — 2026-11-05

| Criterion | Status | Evidence |
| --- | --- | --- |
| Exactly-once game over and immutable result | PASS | `tests/integration/postgres.test.ts` finalization cases exercise both HTTP action service and socket batching: injected replay-write failure rolls back the final break, concurrent identical retries commit once, fresh reads retain score/counters/timestamp, every subsequent lifecycle action conflicts, and direct SQL score updates fail. Existing engine tests check final statistics and DTO leak prevention. |
| Eligibility computed from server data | PASS | Existing policy, private service and PostgreSQL tests derive qualification from owned persisted finished runs and reject active/abandoned runs, foreign owners and caller-provided score fields. New finalization cases read eligibility before/after an actual final move. |
| Unclaimed and unqualified runs excluded from TOP 100 | PASS | New finalization cases verify eligible unclaimed finishes are absent from `readTopRuns()`. Existing PostgreSQL bounded-read/cutoff tests exclude unclaimed, unsupported-cohort and displaced results, reject a lost qualifier's claim, and verify no entry is inserted. Public HTTP reads remain #24/#46 scope. |
| Retries and terminal status tested | PASS | Finalization cases cover concurrent and later exact replay, terminal HTTP/batch rejection, active lookup exclusion and persisted ranking projections; existing lifecycle tests cover all nine invalid moves with resets/reloads/retries. |

The runtime contract was already implemented by the gameplay migration and #31/#33; #39 adds focused transaction regression coverage and documents the integrated behavior. No schema, wire format, ruleset, UI or retention change is required. Application rollback retains immutable results, claims and action replays; no migration or data rewrite is needed.

For environments, migrations, local WebSocket testing and diagnostics, see [server setup](server-setup.md). Distributed rate limits, production monitoring and late-game compute budgets remain release work.

For concrete dependency directions, state ownership, flows and replay-storage growth, see [module boundaries](module-boundaries.md).
