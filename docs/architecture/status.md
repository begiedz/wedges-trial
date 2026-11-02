# Implementation status — 2026-11-02

Gameplay has migrated from browser-owned state to server-authoritative PostgreSQL persistence. The latest implementation is on development (server migration through commit 38f5888). This does not establish production readiness or a completed leaderboard.

| Area | Implemented | Remaining |
| --- | --- | --- |
| Gameplay | Server generation, moves, reset, rewards, continue, abandon and finalization | Difficulty calibration and late-game performance measurements |
| Persistence | Neon/PostgreSQL, Drizzle migrations, atomic versioned actions and replay records | Safe retention policy and operational monitoring |
| Identity | Anonymous hashed-token sessions; Secure, HttpOnly, SameSite=Strict cookie | Leaderboard eligibility and nickname claims |
| Transport | Vercel-native WebSocket, ordered inputs, immediate visual prediction and reconciliation; HTTP recovery/fallback | Deployed WebSocket performance and reconnect verification |
| Client | React adapter over a framework-independent session controller; no gameplay localStorage/sessionStorage | Ranking UI |
| Balance | Approved deterministic ore; reset and continuation preserve pick damage | Pick replenishment and competitive ranking decisions |
| Ranking | Finished runs and metrics persisted | Leaderboard storage, TOP 100 reads, atomic qualification and one claim per run |
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
