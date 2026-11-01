# Server gameplay setup and operations

Use Node.js 22 and pnpm 10.18.3. Development uses the configured Neon database through environment variables; Docker and a separate backend process are unnecessary. See [implementation and verification status](status.md).

## Configure the database

1. Run pnpm install --frozen-lockfile and copy .env.example to gitignored .env if needed.
2. Set DATABASE_URL to a direct development connection and DATABASE_URL_POOLED to its pooled equivalent. Both must belong to the same Neon endpoint/branch and database. The application prefers the pooled URL, falling back to DATABASE_URL.
3. Review committed drizzle/ SQL, then run pnpm db:migrate against the isolated development database. Migrations use DATABASE_URL_UNPOOLED when supplied, otherwise DATABASE_URL. Request handlers and Vercel builds do not initialize tables automatically.
4. Keep database variables in .env for both Next.js and the native migration loader. Next.js also loads .env.local with higher priority; avoid conflicting database overrides there.

Use matching ASCII quotes or no surrounding quotes in local env files. Typographic/mismatched quotes can become part of the URL. In Vercel's environment variable editor, paste the raw value without surrounding quotes. Restart local development after changes; redeploy the relevant Vercel environment after changing its variables.

## Run and test native WebSockets

Set APP_ORIGIN=http://localhost:3000 in gitignored .env.local, then run:

~~~sh
pnpm dev:ws
~~~

This runs Vercel CLI 54.14.2; login/project linking may be required on first use. Stop another Next.js development process in this project first. Open http://localhost:3000/en/game. For another public port, set APP_ORIGIN to that exact browser-facing origin.

Vercel CLI can proxy to a different internal Next.js port. Pinning the public APP_ORIGIN prevents valid browser requests being rejected with 403; do not disable Origin checks or blindly trust forwarded headers. In browser DevTools, Network → WS should show a 101 upgrade at /api/game/socket?run=<UUID>, then ready, action and committed result frames.

Plain pnpm dev runs Next.js directly and can use predicted, queued HTTP fallback. It does not exercise Vercel's native WebSocket upgrade. The same applies to a plain next start runtime. Secure cookies require HTTPS or the browser's localhost exception.

## Environments and deployment

Configure database variables and APP_ORIGIN separately for Vercel Preview and Production. Preview must use an isolated development database. APP_ORIGIN must exactly match the public origin when supplied; without it the handler compares against the request URL origin. Do not set a localhost origin in deployed environments. Never expose credentials through NEXT_PUBLIC_ variables.

Vercel discovers the Next.js Route Handlers in this application; no additional Express service is needed. Native sockets use @vercel/functions and ws. The socket function has a 300-second duration setting, so reconnect is part of normal operation. A successful build does not verify database credentials, migration state or live WebSocket behavior.

Development Neon migration and Preview HTTPS session/run flows were verified. Native WebSocket upgrade was verified locally. Production readiness and deployed WebSocket performance still require explicit checks; see [status](status.md).

## Diagnostics

| Symptom | Check |
| --- | --- |
| POST /api/players/session returns 403 | APP_ORIGIN must equal the browser origin, including scheme/port; check .env.local and the Vercel proxy port. |
| Session/actions return 503 | Use the response requestId to find the structured game_api_failure log. Diagnostics expose allowlisted reason codes, never SQL or credentials. |
| DATABASE_TABLE_MISSING | Apply committed migrations to the database actually selected by the application's pooled URL. |
| DATABASE_TARGET_MISMATCH during migration | Direct and pooled URLs identify different endpoints/databases; copy both from the same Neon branch. |
| DIRECT_DATABASE_URL_REQUIRED or invalid URL | Supply a valid direct PostgreSQL URL; migration connections must not use the pooled hostname. |
| Waiting/retry screen or absent completion dialog | Resolve the failed action first: terminal dialogs require a confirmed server snapshot. Inspect HTTP responses/socket error frames. |
| No 101 upgrade locally | Use pnpm dev:ws; plain Next.js uses HTTP fallback. |

## Migrations and rollback

Keep drizzle/ SQL, meta/_journal.json and snapshots in Git. SQL is reviewable schema history, the journal orders migrations, and snapshots support incremental generation. Run pnpm db:generate when the schema changes, review and commit the result, then explicitly migrate the intended environment. Do not regenerate/edit already-applied migrations. The migration runner uses Drizzle ORM with a direct connection, target validation, timeout and sanitized failures.

On an application rollback, retain tables/data for recovery. Do not drop tables or import editable old browser saves. No automatic retention cleanup exists; preserve sessions, runs and action replays until a safe policy is implemented. Clearing/expiring the anonymous cookie loses access; a nickname cannot recover ownership.

## Verification

Run pnpm test, pnpm lint and pnpm build for relevant code changes. Explicitly set TEST_DATABASE_URL to a nonproduction test connection to enable PostgreSQL integration tests; it is not automatically taken from development credentials. Tests create a random schema, apply committed SQL there and drop only that schema afterward. Without the variable, the database suite is skipped, including in current default CI.

The last implementation verification passed 113 tests with real PostgreSQL enabled, including WebSocket burst/replay, ownership, expiry, concurrent actions and rollback. The build passed. Full lint has pre-existing formatting/import errors; changed code passed focused Biome checks. Local burst timing is not a production latency guarantee.

Remaining release work includes ranking, distributed abuse limits, monitoring, cold-start/late-game budgets, pick balance and difficulty calibration. See [roadmap](roadmap.md).
