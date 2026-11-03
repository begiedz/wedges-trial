# Backend and transport

Gameplay is implemented in one Next.js application on Vercel, using Neon PostgreSQL, Drizzle and the pg driver. [Deployment evidence](status.md) is tracked separately from implementation. The [API contract](api-contract.md) defines wire shapes and retry rules; leaderboard endpoints remain planned.

## Layers

| Layer | Responsibility |
| --- | --- |
| src/app/api/ | Thin HTTP handlers and authenticated WebSocket upgrade |
| src/server/game/ | Validation, ownership, transitions, batching, transactions and safe diagnostics |
| src/server/db/ | Drizzle schema, pg pool and Vercel pool lifecycle integration |
| src/game/ | Pure puzzle rules, generation and reward calculations |
| src/client/game/ | HTTP validation, session orchestration, socket transport, ordered queue and pure prediction |
| src/components/game/ | Controls, session hook and dialogs |

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
| GET (upgrade) | /api/game/socket?run=:id | Authenticated same-origin WebSocket bound to one owned run |

Reset/continue/abandon bodies contain only actionId and expectedVersion. Strict schemas reject client state and scores. All private responses use no-store. Session bootstrap, lifecycle and recovery use HTTP; the client sends rapid moves over WebSocket, with queued HTTP fallback when upgrade is unavailable. Lifecycle controls wait for pending moves to settle.

## Atomic actions

Each mutation uses a PostgreSQL transaction and locks the session row with FOR UPDATE. After ownership/expiry checks, an exact replay is returned before checking the current version/status. Reusing an action ID with a different fingerprint fails. Accepted actions update state, metrics, version and original replay response atomically; errors roll back.

WebSocket input is ordered and adjacent moves can be coalesced (up to 32) into one transaction. Each accepted move still increments version and metrics once and has its own replay record/result. The final run is written once per batch; replies follow commit. Unexpected persistence failure rolls back the whole batch. Database state, rather than a socket-local map, coordinates tabs and function instances.

The client predicts pin movement and damage immediately. Resources, rewards, terminal status and dialogs follow committed snapshots. Reconnect retries unknown actions with their original IDs/versions; stale-version conflicts clear queued predictions and refetch the owned run. Prediction never supplies trusted state.

## Planned ranking

/api/leaderboard and the eligibility/name-claim endpoints are not implemented. The approved target is arcade TOP 100 of claimed finished runs, with ownership validation, one claim per run and an atomic cutoff recheck. Nicknames are presentation only. Ordering and snapshot qualification are implemented as pure policy under #51; see [competitive ranking](competitive-ranking.md). Persistence, authenticated claims and public reads remain planned.

For environments, migrations, local WebSocket testing and diagnostics, see [server setup](server-setup.md). Distributed rate limits, production monitoring and late-game compute budgets remain release work.

For concrete dependency directions, state ownership, flows and replay-storage growth, see [module boundaries](module-boundaries.md).
