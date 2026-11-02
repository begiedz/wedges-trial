# Gameplay module boundaries

Implemented locally for [#56](https://github.com/begiedz/wedges-trial/issues/56). This refactor preserves the wire contract, ruleset, database schema and gameplay behavior; it does not establish deployment readiness. Existing folders form a game feature with internal layers. A mechanical move into `features/game` would add import churn without changing responsibilities.

## Permitted dependency directions

| Module | Owns | May depend on |
| --- | --- | --- |
| `src/game/` | Pure movement, damage, generation, reset, progression and rewards | Other domain modules/types only |
| `src/api/` | Public HTTP/socket contracts | Domain types/constants; never server implementation |
| `src/server/game/engine.ts` | Authoritative transitions, metrics and public DTO projection | Domain rules, stored types and safe application errors |
| `src/server/game/service.ts`, `moveBatch.ts` | Run operations and transaction boundaries | Engine, persistence helpers and DB schema/driver |
| `src/server/game/persistence.ts` | Owner locking, owned reads, fingerprints, replay checks, version checks and writes | DB infrastructure, stored types and DTO projection |
| `src/server/game/session.ts` | Anonymous credentials, session lookup/bootstrap/expiry | Node crypto and DB infrastructure |
| `src/server/game/http.ts`, `socket.ts`, `src/app/api/` | Input limits, authentication/origin checks and transport replies | Validation and application/session services |
| `src/client/game/api.ts`, `response.ts` | HTTP requests, deadlines, status errors and runtime snapshot validation | Public contracts and domain constant |
| `src/client/game/transport.ts` | Socket handshake, heartbeat replies, reconnect/backoff and upgrade fallback signal | Public socket contracts; no game state or command queue |
| `src/client/game/commandQueue.ts`, `prediction.ts` | Confirmed snapshots, ordered pending intents and pure visual prediction | Contracts and pure domain moves |
| `src/client/game/channel.ts` | Sending queued commands, acknowledgements, HTTP fallback and conflict resync | Queue, prediction through queue, transport and HTTP client |
| `src/client/game/session.ts` | Bootstrap/restore, lifecycle commands, pending HTTP retries and channel lifetime | HTTP client/channel; no React, URL access or dialogs |
| `src/components/game/` | React subscription, URL synchronization, dialogs, keyboard and rendering | Client application APIs, contracts and localized presentation |

The DB driver imports `server-only`; client code imports contracts/domain code, never `src/server/`. Domain code imports no React, network, DB or sound modules. Session compatibility exports remain in `service.ts` for current transport consumers, but their implementation is separate. Public command types live in `types.ts`, avoiding dependencies back from persistence/validation into the application service.

## State ownership

`CommandQueue.confirmed` owns the latest accepted server snapshot while the session has a channel. Older or foreign snapshots cannot replace it. Pending commands retain their original action IDs and expected versions until ordered acknowledgement or conflict recovery. A reconnect snapshot may include unacknowledged commits: those intents remain eligible for exact replay, but are excluded from prediction. Even an older replay reply drains its matching command without regressing confirmed state or leaving lifecycle waiters unresolved.

`predictRun()` derives pins and current-pick damage using the same pure `applyMove()` rules as the server. It uses temporary pick counts only to stop prediction at exhaustion. Displayed resources, ore, rewards, result, status and version always come from confirmed state. A predicted solve/exhaustion blocks further moves but cannot open a terminal dialog.

`GameSession` exposes one immutable rendering snapshot through subscribe/getSnapshot. It reads authoritative state from its channel for lifecycle commands; its detached snapshot exists for bootstrap and channel disposal/restart. React has no second confirmed-state ref. `useGameSession` adapts that store with `useSyncExternalStore`, synchronizes the run URL and combines UI-only dialogs. Dialog dismissal and selected pins are presentation state. No gameplay state is saved in browser storage.

## Main flows

1. Bootstrap the anonymous session over HTTP, read the current run, or restore the owned URL run when no active run exists; otherwise create a run. Injecting the restored-ID accessor keeps browser navigation outside session orchestration.
2. Attach the channel and attempt the socket upgrade. Queue moves immediately and render prediction. If the initial upgrade is unavailable, send the same commands sequentially over HTTP. Reconnect sends original commands for replay.
3. Acknowledge only the head command, accept nonregressing snapshots and recompute prediction. On a version/validation conflict, clear speculative inputs and read authoritative state. Unknown failures retain exact commands for retry.
4. Reset/continue/restart wait for queued moves. Unknown HTTP commits retain their exact body/action ID; restart resumes abandonment/creation after replay. The navbar only requests confirmation through the small `events.ts` adapter; it never calls persistence or starts a run itself.

## Domain and transaction guarantees

`evaluateRule()` evaluates final bounds atomically and returns unchanged pins on missing effects or invalid moves. Generation uses it without runtime solved/failed guards because mixing starts from solved pins. Runtime `evaluateMove()` adds those guards and applies damage once. The server consumes the classified result without evaluating movement again. The solver retains its specialized indexed search representation and budget semantics.

`transition()` remains the single authoritative action entry point, dispatching focused move/continue/abandon functions and reset, then incrementing version and constructing the response. Single actions and move batches still own their original transaction boundaries. Both lock the owner before ownership/replay/version checks and use the same fingerprint and write helpers. Batches retain individual replay responses/versions and write the final run once; no reply is sent before commit.

## Replay storage and leaderboard extension

Each accepted action stores a complete original public response. Storage grows with accepted action count multiplied by snapshot size (pins/rules), even when socket moves are batched. This cost is intentional for exact replay; this issue adds no cleanup or retention policy. Any later expiry/compaction must preserve unknown-commit retries, active sessions, claims and the agreed replay window. Do not silently replace historical responses with a current snapshot.

A leaderboard can use separate services, storage, endpoints and UI against immutable finished runs (`status`, ruleset, metrics and `finishedAt`). Ownership/session helpers and the finished-run record are its narrow integration points. The game engine, prediction and socket protocol need no ranking logic. Ranking order, qualification transactions, nickname validation and retention remain separate work under the decision ledger.
