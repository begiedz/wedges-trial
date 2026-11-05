# Implementation status — 2026-11-02

Gameplay has migrated from browser-owned state to server-authoritative PostgreSQL persistence. The latest implementation is on development (server migration through commit 38f5888). This does not establish production readiness or a completed leaderboard.

| Area | Implemented | Remaining |
| --- | --- | --- |
| Gameplay | Server generation, moves, reset, rewards, continue, abandon and finalization | Difficulty calibration and late-game performance measurements |
| Persistence | Neon/PostgreSQL, Drizzle migrations, atomic versioned actions and replay records | Scheduling/monitoring of conservative manual retention |
| Identity | Anonymous hashed-token sessions; Secure, HttpOnly, SameSite=Strict cookie | Leaderboard eligibility and nickname claims |
| Transport | Vercel-native WebSocket, ordered inputs, immediate visual prediction and reconciliation; HTTP recovery/fallback | Deployed WebSocket performance and reconnect verification |
| Client | React adapter over a framework-independent session controller; no gameplay localStorage/sessionStorage | Ranking UI |
| Balance | Approved deterministic ore; reset and continuation preserve pick damage; endless ore ranking approved under #51 | Pick replenishment calibration and release abuse controls |
| Ranking | Finished runs and metrics persisted; pure ordering and snapshot qualification policy tested under #51 | Public endpoints, atomic qualification and claim orchestration (schema/internal reads now implemented under #31) |
| Audio/assets | Existing visual assets | Provenance audit; optional music/SFX controls |

## Verification boundaries

- The committed migration was applied to the configured development Neon database. Local and development Preview HTTPS session/run flows were verified after correcting mismatched direct/pooled database targets.
- Native authenticated WebSocket upgrade and committed action were verified locally through Vercel CLI. Real WebSocket/PostgreSQL tests cover burst input, replay and rollback.
- Before commit 38f5888, 113 tests passed with the opt-in PostgreSQL suite enabled, and the production build passed. Full lint then reported pre-existing formatting/import failures; changed code passed focused checks.
- A push to development triggers a Vercel Preview build; a successful build alone is not end-to-end WebSocket verification. Production migration, production gameplay and leaderboard deployment are not established by these checks.

## Implementation entrypoints

- UI: src/features/gameplay/components/game/game-client.tsx and src/features/gameplay/hooks/use-game-session.ts.
- Client lifecycle: src/client/game/session.ts; HTTP: api.ts and response.ts.
- Client command synchronization: src/client/game/channel.ts and command-queue.ts; prediction.ts and transport.ts own pure prediction and socket lifecycle.
- HTTP and upgrade routes: src/app/api/.
- Validation, orchestration, batching: src/server/game/.
- Schema and driver: src/server/db/; committed migration history: drizzle/.
- Pure puzzle engine: src/game/; localized pages: src/app/[lang]/.

See [setup and troubleshooting](server-setup.md), [backend](backend.md), [API contract](api-contract.md) and [remaining work](roadmap.md). Old browser saves are never imported into trusted runs.

## Modularity refactor (#56)

Movement evaluation and pick damage are shared by generation/runtime/prediction; the server evaluates each move once. Action-specific transitions and shared persistence helpers retain authoritative transaction/replay boundaries. Session lifecycle is independent of React; dialogs, keyboard handling and URL synchronization remain presentation concerns. See [module boundaries and state ownership](module-boundaries.md). No database migration, retention policy, balance change or deployment is part of this refactor.

Local refactor verification on 2026-11-02: 131 tests passed; seven opt-in PostgreSQL integration tests were skipped because TEST_DATABASE_URL was unset. Type checking (`pnpm exec tsc --noEmit`), `pnpm lint` and the production build passed. Lint retains one existing custom-cursor `!important` warning; existing formatting/import errors were corrected without behavior changes. The restricted build stalled and was stopped; the build passed when rerun outside the sandbox. No live database, deployment or browser end-to-end verification was performed for this refactor.

## Competitive scoring policy (#51) — 2026-11-03

The task author approved endless ore ranking. Pure policy now projects server-finished results, orders ore/chests/finish time/UUID and evaluates dynamic TOP 100 snapshot eligibility within deterministic-ore-v1. The [ranking contract](competitive-ranking.md) documents sustain/automation risks, version boundaries and handoff requirements for #24/#34/#46/#47. Claim persistence, atomic rechecks, public endpoints and nickname UI remain unimplemented; no GitHub issue changes, migration or deployment were performed.

Local verification: 145 tests passed; seven opt-in PostgreSQL tests skipped because TEST_DATABASE_URL was unset. Type checking, lint and production build passed; lint retains the existing custom-cursor `!important` warning. The sandboxed build stalled and was stopped; the build passed outside the sandbox. No live database or browser end-to-end verification was performed for this policy-only change.

## Persistence schema (#31) — 2026-11-03

Added claim storage, one-claim/FK/name constraints, immutable terminal results, generated score projections and ranking indexes, bounded internal TOP 100 reads, session revocation checks, replay timestamps and conservative manual cleanup. Fresh migrations and upgrades of existing finished documents are exercised in disposable PostgreSQL; cleanup tests cover concurrent maintenance, live recovery, replay grace periods, active runs, durable claims and transaction rollback. Public claim/read endpoints and atomic cutoff orchestration remain #24/#46 work. No Neon or production migration, cleanup or deployment was performed.

Local #31 verification: 159 tests passed with all 14 PostgreSQL integration tests enabled, including legacy migration backfill. Fresh migration and immediate journal rerun succeeded; schema generation reports no drift. Type checking, lint and production build passed (existing cursor `!important` lint warning). PostgreSQL tests and build required execution outside the sandbox. See [acceptance evidence](data-model.md#issue-31-acceptance-evidence--2026-11-03).

## Gameplay statistics (#49) — 2026-11-04

Completed the existing authoritative chest/run metrics with verified initial-layout `optimalMoves` metadata and localized Game Over totals (moves, invalid moves, broken picks). Optima remain server-private and unavailable for construction-only fallbacks/legacy locks. Counters stay in `StoredGame`; no incompatible `RunState` change, SQL migration, score change or ruleset split is required. Historical replay replies remain compatible. See [acceptance evidence](gameplay.md#issue-49-acceptance-evidence--2026-11-04) and [data compatibility](data-model.md#statistics-compatibility-49).

Local verification: all 174 tests passed with all 15 PostgreSQL integration tests enabled against disposable local PostgreSQL 17, including real WebSocket reconnect/replay, races, reset/finalization and rollback. Type checking, lint and production build passed; lint retains the existing cursor `!important` warning. The sandboxed build stalled and was stopped; the build passed outside the sandbox. No Neon/production migration, deployment, browser end-to-end verification or GitHub issue mutation was performed.

## Deterministic reward completion (#47) — 2026-11-05

Centralized the already-approved ore parameters and documented calculation details beside `getDeterministicOre()`. At the task author's request, the reward dialog and translations retain their previous appearance, with no breakdown fields or rules in the UI. Authoritative rewards now roll picks separately from ore. No score, replenishment, ruleset or SQL schema change was made. A seeded resource simulation documents long-run sustain and ore distribution, including censored survivors and high chest indices; this is not player/difficulty calibration. See [#47 acceptance evidence and rollback](gameplay.md#reward-transparency-and-balance-evidence-47--2026-11-05).

Local #47 verification: all 198 tests passed with all 16 PostgreSQL integration tests enabled against disposable local PostgreSQL 17. Type checking, lint and production build passed; lint retains the existing custom-cursor `!important` warning. The sandboxed build stalled and was stopped; the build passed outside the sandbox. No Neon/production migration, deployment, browser end-to-end verification or GitHub issue mutation was performed.

After the requested UI restoration, 177 tests passed and 16 opt-in PostgreSQL tests were skipped (TEST_DATABASE_URL unset). Type checking, lint and production build passed; the existing cursor warning remains. The reward dialog, dictionaries and wire contracts match their pre-#47 versions; the calculation is explained in the function comment. The earlier 198-test result above applies to the superseded breakdown implementation.

## Feature-based frontend (#57) — 2026-11-05

Gameplay React components, hooks, dialogs, controls and lock visualization now live in `src/features/gameplay/`, with colocated React tests and a minimal public API for route/layout composition. The existing debug tester belongs to `features/lock-debug`. Shared navigation takes an action slot; it no longer imports gameplay. The reused pin-selection helper belongs to `lib`. Domain, API, session controller and authoritative server behavior are unchanged; no database migration or runtime dependency was added.

`pnpm check:architecture` enforces dependency directions, feature privacy, cycles and transitive server-only dependencies. Lint/tests invoke it in local development and existing CI. Local verification: 209 tests passed; 16 PostgreSQL tests skipped (`TEST_DATABASE_URL` unset; no working local server executable). Type checking, lint and production build passed; existing cursor CSS warning remains. The sandboxed build stalled and was stopped; the build passed outside the sandbox. No browser end-to-end, live database, migration, deployment or GitHub issue mutation was performed. See [criterion-by-criterion acceptance evidence](module-boundaries.md#issue-57-acceptance-evidence--2026-11-05), including the unverified environment-dependent PostgreSQL suite.

## Filename and test conventions (#59) — 2026-11-05

Project-owned source/test filenames now use lowercase kebab-case independently of TypeScript symbols. All tests live under `tests/`, with matching source directories/basenames and explicit multi-module integration suites; this supersedes #57's temporary feature test colocation and coordinates #58's placement convention. Framework/tooling names, third-party assets and generated migration files are preserved. `pnpm check:names` enforces naming and mirroring through lint/CI and regression tests. Vitest discovers the centralized tests and provides V8 coverage through one matching development-only provider. CI adds coverage and production-build checks.

Local verification on a copied, case-sensitive Linux filesystem (Node 22): `pnpm test` and `pnpm test:coverage` each passed all 237 tests, including all 16 PostgreSQL integration tests against disposable PostgreSQL 17. Typecheck, lint and production build passed; the existing cursor CSS warning remains. Coverage maps to renamed sources (62.67% statements/lines, 87.92% branches, 78.51% functions). Syntax comparison of all 127 existing source/test modules confirmed only path/import-order changes. No gameplay, API, stored-data or symbol-naming change; no Neon/production migration, deployment, live browser check or GitHub mutation. See [criterion-by-criterion evidence and rollback](../agent/file-naming.md#issue-59-acceptance-evidence--2026-11-05).
