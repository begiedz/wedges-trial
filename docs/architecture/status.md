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

- UI: src/components/game/GameClient.tsx and useGameSession.ts.
- Client lifecycle: src/client/game/session.ts; HTTP: api.ts and response.ts.
- Client command synchronization: src/client/game/channel.ts and commandQueue.ts; prediction.ts and transport.ts own pure prediction and socket lifecycle.
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
