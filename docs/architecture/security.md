# Security and abuse model

## Implemented gameplay controls

The server computes all trusted state, damage, rewards and final results. Client prediction is rendering only. Editing browser state or submitting score fields cannot alter persisted resources; valid-action bots and automated solvers are still possible.

- Anonymous credentials are 256-bit random tokens in Secure, HttpOnly, SameSite=Strict cookies. Only SHA-256 hashes are stored. Sessions expire after 30 days; expiry and explicit revocation are rechecked under the mutation transaction lock.
- HTTP mutations and WebSocket upgrade require the exact allowed Origin. Private gameplay and leaderboard eligibility/claim operations authorize ownership; foreign/unknown run IDs both return 404. A run UUID is not a credential.
- Strict runtime schemas reject unknown fields, malformed IDs, invalid versions/directions and caller-owned state. HTTP bodies and socket frames are capped at 2 KiB.
- Session-row locking, version checks and owner-scoped action IDs protect concurrent writes and exact retries. State, counters and replay responses commit atomically, including batched moves.
- Socket queue, frame, rate, heartbeat and outgoing-buffer limits bound individual connections. They are not distributed abuse protection.
- Public snapshots may include movement rules for prediction. Seeds, initial locks, internal solver metadata, ownership fields, token hashes and database credentials remain private. Concealing public mechanics is not an anti-bot guarantee.
- Structured diagnostic logs use correlation IDs and allowlisted failure reasons, without raw SQL, connection strings or request secrets. Client errors remain generic and localized by code.
- Debug/solver pages reject production access. Private HTTP responses use no-store. Old editable browser saves receive no trusted score credit.

## Remaining release controls

Distributed rate limits, measured compute budgets, monitoring and deployed reconnect/expiry checks remain work. Private leaderboard claims authenticate finished-run ownership, validate names, recheck TOP 100 cutoff under a cohort transaction lock and enforce one claim per run with atomic action replay. Public ranking reads and nickname UI remain separate work. Nicknames are presentation only, never authentication.

Keep Preview/development and Production databases isolated; tests must never use Production. Migration credentials remain server-only. Asset redistribution requires a provenance/licensing audit independently of application security.

## Verification

Tests cover foreign ownership, malformed input, invalid/expired cookies, duplicate/reused IDs, stale versions, concurrent actions, reward once, rollback, DTO leaks and Origin/proxy configuration. Socket tests cover burst/replay, bounded frames, expiry and client recovery. See [setup](server-setup.md) for opt-in PostgreSQL tests and [status](status.md) for evidence limits.

## Anonymous session lifecycle (#33)

Bootstrap accepts `{}` and never a name/profile. A valid cookie restores its existing owner without rotating the credential or extending its fixed expiry. Refresh and tabs sharing that cookie see the same owner and coordinate through database locks/versions. An independent browser, deleted cookie, malformed/unknown token or expired/revoked cookie cannot recover the prior owner; bootstrap creates a fresh owner. The raw credential is returned only in Set-Cookie, never JSON, logs or stored game state. Concurrent first visits before any cookie exists can create distinct anonymous owners; there is no cross-browser identity mechanism.

Expiry/revocation ends private reads, writes and claims, including exact action retries. No automatic reassignment of an old run takes place. Expired active runs remain protected by the conservative retention policy; claimed records survive loss of browser access. See [retention](data-model.md#conservative-retention-policy-31). Session expiry is not sliding and does not promise permanent result access. Explicit revocation is the existing internal database field; no public revoke endpoint is introduced.
