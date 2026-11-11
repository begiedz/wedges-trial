# Security and abuse model

## Implemented gameplay controls

The server computes all trusted state, damage, rewards and final results. Client prediction is rendering only. Editing browser state or submitting score fields cannot alter persisted resources; valid-action bots and automated solvers are still possible.

- Anonymous credentials are 256-bit random tokens in Secure, HttpOnly, SameSite=Strict cookies. Only SHA-256 hashes are stored. Sessions expire after 30 days; expiry and explicit revocation are rechecked under the mutation transaction lock.
- HTTP mutations and WebSocket upgrade require the exact allowed Origin. Private gameplay and leaderboard eligibility/claim operations authorize ownership; foreign/unknown run IDs both return 404. A run UUID is not a credential.
- Strict runtime schemas reject unknown fields, malformed IDs, invalid versions/directions and caller-owned state. HTTP bodies and socket frames are capped at 2 KiB.
- Session-row locking and version checks protect concurrent writes. Move/reset retries resynchronize instead of storing historical replies; creation/claim identity markers retain duplicate protection; lifecycle retries use their original versions. State and counters commit atomically, including batched moves.
- Socket queue, frame, rate, heartbeat and outgoing-buffer limits bound individual connections. They are not distributed abuse protection.
- Public snapshots may include movement rules for prediction. Seeds, initial locks, internal solver metadata, ownership fields, token hashes and database credentials remain private. Concealing public mechanics is not an anti-bot guarantee.
- Structured diagnostic logs use correlation IDs and allowlisted failure reasons, without raw SQL, connection strings or request secrets. Client errors remain generic and localized by code.
- Debug/solver pages reject production access. Private HTTP responses use no-store. Old editable browser saves receive no trusted score credit.

## Remaining release controls

Measured compute budgets, monitoring and deployed reconnect/expiry checks remain work. Private leaderboard claims authenticate finished-run ownership, validate names, recheck TOP 1000 cutoff under a cohort transaction lock and enforce one claim per run with accepted claim identity/rank. Public ranking reads use bounded live pages without snapshot storage or signed cursors; localized nickname entry is implemented under #34. Public reads expose only ranking DTOs and use no-store without creating a session. PostgreSQL-backed leaderboard request budgets (#46) cap public traversal starts/pages globally and private eligibility/claims per authenticated session; denied requests return 429 with Retry-After. See [admission boundaries](api-contract.md#leaderboard-admission-and-caching-46). These bound ranking work across instances, but public global quotas can affect legitimate traffic and session creation remains outside these limits. Edge/session abuse controls, traffic calibration and broader distributed gameplay limits remain #43 release work. Nicknames are presentation only, never authentication.

Keep Preview/development and Production databases isolated; tests must never use Production. Migration credentials remain server-only. Asset redistribution requires a provenance/licensing audit independently of application security.

## Verification

Tests cover foreign ownership, malformed input, invalid/expired cookies, duplicate/reused IDs, stale versions, concurrent actions, reward once, rollback, DTO leaks and Origin/proxy configuration. Socket tests cover burst/replay, bounded frames, expiry and client recovery. See [setup](server-setup.md) for opt-in PostgreSQL tests and [status](status.md) for evidence limits.

## Anonymous session lifecycle (#33)

Bootstrap accepts `{}` and never a name/profile. A valid cookie restores its existing owner without rotating the credential or extending its fixed expiry. Refresh and tabs sharing that cookie see the same owner and coordinate through database locks/versions. An independent browser, deleted cookie, malformed/unknown token or expired/revoked cookie cannot recover the prior owner; bootstrap creates a fresh owner. The raw credential is returned only in Set-Cookie, never JSON, logs or stored game state. Concurrent first visits before any cookie exists can create distinct anonymous owners; there is no cross-browser identity mechanism.

Expiry/revocation ends private reads, writes and claims, including exact action retries. No automatic reassignment of an old run takes place. Expired-owner active runs can be reclaimed under the seven-day active/24-hour terminal expiry; compact claimed results survive removal of source runs and sessions. See [retention](data-model.md#physical-cleanup). Session expiry is not sliding and does not promise permanent result access. Explicit revocation is the existing internal database field; no public revoke endpoint is introduced.


## Scheduled retention

The maintenance route uses a server-only bearer credential (`CRON_SECRET`), not a player session. Missing configuration fails closed; incorrect/missing credentials return 401 before any database work. It uses no-store and generic safe failures. The daily job uses the same bounded owner-first cleanup transaction as explicit operator invocation. Counters and compact claims are not deleted by expiry. Configure the secret only after compact ranking readers are deployed; see [rollout and rollback](data-model.md#migration-and-controlled-cutover).


## Final four-table cutover

Migration 0005 removes action/snapshot/quota tables. Shared admission remains in fixed session/global fields. Creation markers prevent delayed retries from recreating expired games; claims retain immutable one-claim identity. Full terminal puzzles are discarded immediately; expired summaries return 404 independently of scheduled cleanup. Existing-database migration requires explicit STORAGE_CUTOVER=1 during a controlled app switch, not an unattended build. See [rollout](data-model.md#migration-and-controlled-cutover).

New nickname claims also use the [simple four-language substring blacklist](nickname-moderation.md). Accepted identities replay before the current vocabulary; rejected names remain correctable and consume no claim.
