# Gameplay module boundaries

The #56 responsibility boundaries are retained. The #57 frontend refactor moves product-specific React presentation into `src/features/`, following applicable [Bulletproof React principles](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md). Routes compose small public feature APIs; the pure domain, framework-independent session controller, shared contracts and authoritative backend remain separate. This is local implementation, not deployment evidence.

## Frontend ownership and migration audit (#57)

| Before | Owner after migration | Consumers / reason |
| --- | --- | --- |
| `components/game/` components, dialogs, events | `features/gameplay/components/game/`, private `events.ts` | Game route and internal gameplay presentation |
| `components/game/useGame*` | `features/gameplay/hooks/` | React adapter, dialogs and keyboard handling; `GameSession` stays in `client/game` |
| `components/lock/` | `features/gameplay/components/lock/` | Gameplay-only sliding plate (`plate.tsx`) and stationary pin (`pin.tsx`) rendering |
| General `difficulty`, `movement`, `item-frame` | `features/gameplay/components/game/` | Only game screen/reward dialog use them; no demonstrated site-wide reuse |
| `components/lock-debug/` | `features/lock-debug/` | Existing development-only debug route, separate from trusted gameplay |
| `client/game/pinSelection.ts` | `lib/pin-selection.ts` | Pure presentation helper reused by gameplay and debug; no session responsibility |
| React test suites | `tests/features/gameplay/`, `tests/integration/gameplay/` | #59 supersedes temporary #57 colocation with mirrored module tests and multi-module integration suites |
| Navbar imports gameplay events | Shared navbar takes optional `renderAction` slot | Gameplay's `GameplayNavigation` composes it, owns route visibility and dispatches the private confirmation event |

`features/gameplay/index.ts` exports only `GameClient` (game page) and `GameplayNavigation` (locale layout). The debug feature exports only `TextLockTester`. Other files are private; feature internals import one another directly, not through their own public barrel. Generic primitives and site-wide navigation, branding, cards, header and footer remain shared. Dictionaries/provider and assets stay shared without copy changes.

The debug feature intentionally simulates local domain state for inspection, never reads/writes trusted runs, and remains unavailable in production through the existing route gate. This is an explicit tooling exception to server-owned gameplay, not a second gameplay implementation. It uses no gameplay-private components or hooks.

Migration sequence: inventory consumers and dependency directions; move presentation/hooks/tests without logic edits; update routes and remove old paths; invert navbar dependency through composition; enforce boundaries; run existing behavior regressions and new navigation/boundary checks. No compatibility re-exports or placeholder leaderboard/audio folders remain.

## Adding a feature

1. Put product-specific React UI, hooks, UI state and presentation helpers in `src/features/<name>/`; create only folders with content.
2. Expose only components/interfaces needed by routes in one `index.ts`. Keep Next.js routing/layout/API files in `app` and preserve client directives on interactive entry components.
3. Routes/layouts compose features and shared site UI. Features consume `client`, contracts and domain as needed, never `app` or `server`. No cross-feature imports, even via another feature's public API: compose at route level instead.
4. Keep shared primitives feature-independent. Move helpers into shared modules only for demonstrated reuse. Do not move domain, session orchestration or server services into a feature.
5. Keep trusted resources/outcomes in server-confirmed snapshots and adapt `GameSession` with `useSyncExternalStore`. Feature state is limited to rendering, input selection and dialogs.
6. Mirror feature tests under `tests/features/<name>/` with matching kebab-case basenames; use `tests/integration/` for multi-module suites (see [naming rules](../agent/file-naming.md)); use public APIs from routes and direct private imports only within the owning feature/tests.

## Automated enforcement

`pnpm check:architecture` parses source imports with the already-installed TypeScript compiler (no new dependency). `pnpm lint` runs it before Biome; `pnpm test` also checks the repository and exercises forbidden-import fixtures, so existing CI runs both gates. Errors identify file, line, dependency and the permitted direction; cycle and transitive server-only failures include the import chain.

The check covers aliases and relative paths, imports/re-exports, literal dynamic imports/require, import types and cycles (including type dependencies). It forbids cross-feature imports, private route imports, shared-to-feature/application dependencies, domain dependencies outside the domain and selected browser/network globals, React/Next in the client controller, and server-to-frontend imports. It traces frontend dependencies through helpers to detect `server-only`, Node built-ins, PostgreSQL/Drizzle and Vercel server functions. Shared server dictionary loading remains legal for server routes; client consumers cannot reach it. Feature tests are excluded from the production graph and checked by Vitest/typecheck instead. This is a source dependency guard, not a bundler/security proof; review unrecognized external packages and computed imports separately.

## Permitted dependency directions

| Module | Owns | May depend on |
| --- | --- | --- |
| `src/game/` | Pure movement, damage, generation, reset, progression and rewards | Other domain modules/types only |
| `src/api/` | Public HTTP/socket contracts | Domain types/constants; never server implementation |
| `src/server/game/engine.ts` | Authoritative transitions, metrics and public DTO projection | Domain rules, stored types and safe application errors |
| `src/server/game/service.ts`, `move-batch.ts` | Run operations and transaction boundaries | Engine, persistence helpers and DB schema/driver |
| `src/server/game/persistence.ts` | Owner locking, owned reads, fingerprints, replay checks, version checks and writes | DB infrastructure, stored types and DTO projection |
| `src/server/game/session.ts` | Anonymous credentials, session lookup/bootstrap/expiry | Node crypto and DB infrastructure |
| `src/server/game/http.ts`, `socket.ts`, `src/app/api/` | Input limits, authentication/origin checks and transport replies | Validation and application/session services |
| `src/client/game/api.ts`, `response.ts` | HTTP requests, deadlines, status errors and runtime snapshot validation | Public contracts and domain constant |
| `src/client/game/transport.ts` | Socket handshake, heartbeat replies, reconnect/backoff and upgrade fallback signal | Public socket contracts; no game state or command queue |
| `src/client/game/command-queue.ts`, `prediction.ts` | Confirmed snapshots, ordered pending intents and pure visual prediction | Contracts and pure domain moves |
| `src/client/game/channel.ts` | Sending queued commands, acknowledgements, HTTP fallback and conflict resync | Queue, prediction through queue, transport and HTTP client |
| `src/client/game/session.ts` | Bootstrap/restore, lifecycle commands, pending HTTP retries and channel lifetime | HTTP client/channel; no React, URL access or dialogs |
| `src/features/gameplay/` | React subscription, URL synchronization, dialogs, keyboard and rendering | Client application APIs, contracts and localized presentation |

The DB driver imports `server-only`; client code imports contracts/domain code, never `src/server/`. Domain code imports no React, network, DB or sound modules. Session compatibility exports remain in `service.ts` for current transport consumers, but their implementation is separate. Public command types live in `types.ts`, avoiding dependencies back from persistence/validation into the application service.

## State ownership

`CommandQueue.confirmed` owns the latest accepted server snapshot while the session has a channel. Older or foreign snapshots cannot replace it. Pending commands retain their original action IDs and expected versions until ordered acknowledgement or conflict recovery. A reconnect snapshot may include unacknowledged commits: those intents remain eligible for exact replay, but are excluded from prediction. Even an older replay reply drains its matching command without regressing confirmed state or leaving lifecycle waiters unresolved.

`predictRun()` derives plate alignment (the existing `pins` model) and current-pick damage using the same pure `applyMove()` rules as the server. It uses temporary pick counts only to stop prediction at exhaustion. Displayed resources, ore, rewards, result, status and version always come from confirmed state. A predicted solve/exhaustion blocks further moves but cannot open a terminal dialog.

`GameSession` exposes one immutable rendering snapshot through subscribe/getSnapshot. It reads authoritative state from its channel for lifecycle commands; its detached snapshot exists for bootstrap and channel disposal/restart. React has no second confirmed-state ref. `useGameSession` adapts that store with `useSyncExternalStore`, synchronizes the run URL and combines UI-only dialogs. Dialog dismissal and selected plates (`selectedPinId`) are presentation state. No gameplay state is saved in browser storage.

## Main flows

1. Bootstrap the anonymous session over HTTP, read the current run, or restore the owned URL run when no active run exists; otherwise create a run. Injecting the restored-ID accessor keeps browser navigation outside session orchestration.
2. Attach the channel and attempt the socket upgrade. Queue moves immediately and render prediction. If the initial upgrade is unavailable, send the same commands sequentially over HTTP. Reconnect sends original commands for replay.
3. Acknowledge only the head command, accept nonregressing snapshots and recompute prediction. On a version/validation conflict, clear speculative inputs and read authoritative state. Unknown failures retain exact commands for retry.
4. Reset/continue/restart wait for queued moves. Unknown HTTP commits retain their exact body/action ID; restart resumes abandonment/creation after replay. The navbar only requests confirmation through the small `events.ts` adapter; it never calls persistence or starts a run itself.

## Domain and transaction guarantees

`evaluateRule()` evaluates final bounds atomically and returns unchanged plate alignment (`pins`) on missing effects or invalid moves. Generation uses it without runtime solved/failed guards because mixing starts from solved plate positions. Runtime `evaluateMove()` adds those guards and applies damage once. The server consumes the classified result without evaluating movement again. The solver retains its specialized indexed search representation and budget semantics.

`transition()` remains the single authoritative action entry point, dispatching focused move/continue/abandon functions and reset, then incrementing version and constructing the response. Single actions and move batches still own their original transaction boundaries. Both lock the owner before ownership/replay/version checks and use the same fingerprint and write helpers. Batches retain individual replay responses/versions and write the final run once; no reply is sent before commit.

## Replay storage and leaderboard extension

Each accepted action stores a complete original public response. Storage grows with accepted action count multiplied by snapshot size (pins/rules), even when socket moves are batched. This cost is intentional for exact replay; this issue adds no cleanup or retention policy. Any later expiry/compaction must preserve unknown-commit retries, active sessions, claims and the agreed replay window. Do not silently replace historical responses with a current snapshot.

A leaderboard can use separate services, storage, endpoints and UI against immutable finished runs (`status`, ruleset, metrics and `finishedAt`). Ownership/session helpers and the finished-run record are its narrow integration points. The game engine, prediction and socket protocol need no ranking logic. Ranking order, qualification transactions, nickname validation and retention remain separate work under the decision ledger.

## Issue #57 acceptance evidence — 2026-11-05

Statuses describe local source and automated verification. They do not establish production behavior or browser/device end-to-end coverage.

| Definition of Done criterion | Status | Evidence |
| --- | --- | --- |
| Existing gameplay React presentation resides in gameplay feature | PASS | Screen, three hooks, dialogs, events, controls and lock visualization moved; ownership audit above |
| Features are standard for product-specific frontend functionality | PASS | This guide, architecture README, root AGENTS, frontend skill and agent working agreement |
| Small intentional public APIs used by routes | PASS | Gameplay exports `GameClient`/`GameplayNavigation`; debug exports `TextLockTester`; game/debug pages and locale layout use entry points |
| Shared UI independent; obsolete paths removed | PASS | Navbar action slot, dependency checker; old game/lock/debug folders removed without re-exports |
| No empty features, speculative modules or runtime dependencies | PASS | Only implemented gameplay/debug features; dependency list and lockfile unchanged |
| Domain/client/contracts/server retain responsibilities | PASS | No modifications to domain/API/server; only presentation pin-selection helper moved out of client; non-import code in all 25 moved source files compared unchanged |
| No circular/private cross-feature/server-to-client imports | PASS | Repository dependency graph and 29 architecture regression cases |
| Critical boundaries checked locally and in CI | PASS | `check:architecture` invoked by lint and architecture test; existing CI runs lint/tests |
| GameSession/useSyncExternalStore/state ownership preserved | PASS | Adapter body unchanged; `gameSession`, `sessionController`, channel and queue suites |
| Mechanics/generation/reset/progression/rewards/damage/scoring unchanged | PASS | Unchanged domain/server sources; existing domain, server engine, reward and reset tests |
| Prediction/ordering/reconnect/replay/fallback/conflict recovery preserved | PASS | Existing prediction, commandQueue, gameChannel, gameSocket, gameApi and sessionController suites |
| Input, dialogs, game-over and restoration preserved | PASS | Colocated gameClient/gameClientLifecycle/gameDialogs/gameSession tests; new desktop/mobile navigation tests verify event delivery, menu closing and route visibility; moved control/lock implementation bodies unchanged |
| Contracts/localization/routing/server authority unchanged | PASS | Contract, dictionary and server sources unchanged; localized route composition retained; HTTP/socket and four-language dialog tests |
| No DB/persistence/transaction/version/idempotency changes | PASS | No schema/migration/persistence/service edits |
| TypeScript gate | PASS | `pnpm exec tsc --noEmit`; build also runs TypeScript |
| Lint gate | PASS | `pnpm lint`, including boundary check; existing cursor CSS `!important` warning remains |
| Unit/integration test gate, skips reported | PASS | `pnpm test`: 209 passed, 16 opt-in PostgreSQL tests skipped because `TEST_DATABASE_URL` unset |
| Production build gate | PASS | `pnpm build` outside sandbox; sandboxed build stalled and was stopped |
| Environment-dependent PostgreSQL regressions | NOT VERIFIED | No configured test URL; attempted disposable local setup unavailable because installed PostgreSQL files lack a server executable. No Neon/production connection used |
| Documentation/imports/test paths reflect final implementation | PASS | Ownership/migration guide above, updated READMEs/status/backend/agent guidance; Vitest included colocated feature tests at #57; superseded by the #59 centralized convention |

No deployment, database migration, live browser end-to-end check or GitHub issue mutation was performed. Rollback is a source-only revert; no stored data or wire-version conversion is needed.
