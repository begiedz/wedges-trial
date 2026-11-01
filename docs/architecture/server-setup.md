# Server gameplay setup and operations

Implemented locally: #33, #35–#40 gameplay paths, #41 browser persistence removal, #49 server metrics; #31–#32 gameplay schema/transactions. This is not a claim that entire issues (including leaderboard requirements) are complete or deployed.

## Configure and run

1. `pnpm install`.
2. Use the gitignored `.env` for development: `DATABASE_URL` is the direct Neon connection and `DATABASE_URL_POOLED` is the pooled application connection. Next.js loads `.env` automatically; the Drizzle config and migration runner also load it. The application prefers `DATABASE_URL_POOLED`, falling back to `DATABASE_URL`. Migrations use `DATABASE_URL_UNPOOLED` if supplied, otherwise `DATABASE_URL`. Use Node.js 20.12+ (native environment-file loading). Never point development/tests at Production.
3. Review `drizzle/` SQL, then explicitly run `pnpm db:migrate` on your isolated development/Preview database. Request handlers never migrate automatically.
4. Set `APP_ORIGIN` to the exact public origin, e.g. `https://trial.example`. Locally omit it (or leave empty) to use the request URL origin. Use `pnpm dev`; Secure cookies require HTTPS or a browser's localhost secure-cookie exception.
5. Use `/en/game` (also pl/de/ru). Bootstrap creates an anonymous cookie with 30-day fixed expiry. Gameplay never imports old browser saves. A public run UUID in the `?run=` URL enables finished-result refresh; it grants no access without the owner cookie.

The driver is `pg` with Drizzle interactive transactions and Vercel pool lifecycle handling. All mutations lock the session row before replay lookup and run mutation, serializing writes for that owner across runs/tabs. `UNIQUE(owner_id, action_id)` covers creation and every mutation. State and original response commit together. Reads use no-store. Session credentials are 256-bit random tokens; only SHA-256 hashes are stored. Expiry is checked on reads and rechecked under the transaction lock. Advancing `expires_at` into the past revokes a session.

## Verification

`pnpm test`, `pnpm lint`, `pnpm build`.

Set `TEST_DATABASE_URL` to a disposable PostgreSQL database and run `pnpm test`. The integration suite creates a randomly named schema, applies the committed migration there, tests replay/concurrency/rollback and drops only that schema afterward. Without that variable it explicitly skips the database suite. Do not use Production credentials. Development uses the Neon connection from `.env`; Docker is not required. For integration tests, explicitly provide a separate test database via `TEST_DATABASE_URL`; do not automatically reuse the development database.

## Retention and rollback

No automatic deletion is implemented. Retain sessions, runs and replay records together; do not prune records while a run/action can be resumed or retried. Finished and abandoned runs remain immutable. A future retention policy must preserve claimed leaderboard references and replay tombstones.

Before switching an existing deployment, prepare an isolated Preview database, apply migrations and exercise session cookies, refresh, concurrent actions and late-game generation there. Roll back application deployment if necessary; retain the new tables and data for recovery. Never drop tables or import editable local saves to recover ranked scores. No Production migration or deployment is part of this task.

## Outstanding release work

- Leaderboard storage, eligibility, nickname claims and public ranking (#24/#25/#34/#46), including final ranking decision #51. No score claim endpoint is exposed yet.
- Shared/distributed rate limits and measured operational budgets (#43/#28/#44). Strict schemas, a 2 KiB body cap, Origin checks and ownership exist, but these do not replace rate limits or stop valid-action bots.
- Neon/Vercel Preview integration, cold starts, deployment and production monitoring. Local PostgreSQL verification does not establish deployment performance.
- Pick replenishment balance, difficulty calibration and solver evidence (#47/#48/#50/#51). Ore is `floor((10 + 5*(chest-1))*max(4,10-invalidMoves)/10)` under `deterministic-ore-v1`; pick rewards retain existing probabilities. No unverified-optimum penalty is used.
- Session expiry/cookie deletion loses anonymous ownership; it is not recoverable by nickname.

## Verification record (2026-11-01)

93 tests passed including real PostgreSQL 17 migration, session expiry, foreign access, concurrent writes, replay and rollback. `pnpm db:migrate` was exercised only against the disposable local test container. The production build passed, and a running production server passed HTTP smoke checks for Secure cookie bootstrap, create/replay, move, restore, stale-version rejection and abandonment. Neon/Vercel runtime behavior remains unverified. Full lint reports pre-existing formatting/import errors in unrelated UI scaffolding; changed-file Biome checks pass.

## Committed migrations

Keep `drizzle/` in Git, including SQL, `meta/_journal.json` and snapshots. SQL is the reviewable migration history; the journal tracks order, and snapshots let Drizzle generate incremental migrations. Generate and commit new migrations when the schema changes. Do not regenerate or edit already-applied migrations. `.env` stays ignored and must not be committed.

## Development database update — 2026-11-01

Development now uses the user-supplied `.env` connections, without Docker. A read-only connection check passed and the committed migration was applied successfully to that configured development database. `pnpm db:migrate` uses the Drizzle ORM migrator through `scripts/migrate.cjs`, with direct-URL validation, connection timeout and sanitized failure codes. This avoids the Drizzle Kit CLI exiting without a diagnostic in this environment. The generated SQL/journal remain the migration source of truth. No production deployment was performed.

## Database target troubleshooting — 2026-11-01

A direct URL and a pooled URL must point to the same Neon endpoint/branch and database. A verified incident had existing tables on the direct endpoint while the application’s pooled endpoint had no tables, so a successful migration did not initialize the application database. The migration runner now rejects this mismatch with `DATABASE_TARGET_MISMATCH`, including explicit `DATABASE_URL_UNPOOLED` overrides. Copy the direct and pooled connections from the same Neon branch; do not pair connections from different branches.

Use either no surrounding quotes or matching ASCII quotes in `.env`. A mismatched opening ASCII quote and closing typographic quote (`”`) produces different parsing between native Node environment loading and Next.js, and can leave quote characters inside the connection string. Restart the development server after correcting connection variables because its database pool is cached. Secrets remain untracked.

## Fast gameplay over WebSocket — 2026-11-01

Gameplay uses the authenticated same-origin `/api/game/socket?run=<UUID>` endpoint on Vercel Functions with `@vercel/functions` 3.10.5 and `ws`. This no longer requires a separate WebSocket host: Vercel WebSockets are generally available as of 2026-10-20. HTTPS remains for bootstrap, run lifecycle, recovery and an explicit transport fallback when a local runtime cannot upgrade sockets.

Start native WebSocket development with `pnpm dev:ws` (Vercel CLI 54.14.2). Stop any existing `next dev` process in this project first. For the default public local address, set `APP_ORIGIN=http://localhost:3000` in gitignored `.env.local`; Vercel CLI can proxy to a different internal Next.js port, so comparing against that internal URL alone rejects the browser origin with 403. Use the exact browser-facing origin if selecting another port. This pins CSRF checks to one allowed origin; do not disable Origin validation or blindly trust forwarded headers. Plain `pnpm dev` can still use predicted, queued HTTPS input, but native upgrade testing requires Vercel CLI. In DevTools Network → WS, expect status 101 and ready/action/result frames.

Movement is predicted synchronously for rendering and queued in order rather than blocking the controls for every round trip. The public snapshot contains `moveRules` (movement mechanics required to predict rendering), but no seed, solver paths or verified optimum. Predicted pins/damage are temporary UI state; ore, lockpicks, rewards, terminal statuses and persistence remain server-confirmed. Server snapshots reconcile outstanding predictions. No gameplay is saved in browser storage.

The server coalesces up to 32 queued moves in one PostgreSQL transaction, persists each accepted action and its original response, and updates the final run once. Every accepted input still consumes one version and updates metrics once. Exact retries retain the original action ID/version; reconnect replays unknown commits, while version conflicts discard queued predictions and refetch authoritative state. Heartbeats and reconnect handle function duration limits. Session expiry, origin, ownership, frame size, input queue limits and per-connection message limits are checked; distributed abuse limits remain separate work.

Verification: a real authenticated WebSocket upgrade on localhost through Vercel CLI succeeded, including ready → action → committed result. A real WebSocket/PostgreSQL integration test committed a 20-move burst in 311 ms total and replayed all moves without incrementing version again. Client tests prove rapid inputs render before any acknowledgement. The latency number is a local measurement, not a production guarantee.
