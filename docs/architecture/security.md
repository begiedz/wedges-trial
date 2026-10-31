# Security and abuse model

## Guarantees and non-guarantees

HTTPS encrypts requests in transit; WebSockets do not inherently prevent cheating. **Server authority** makes tampering with `localStorage`, JavaScript state and arbitrary score submissions ineffective, but it cannot fully prevent bots that send syntactically valid moves or solve puzzles automatically.

## Threats and controls

| Threat | Required control |
| --- | --- |
| Edited browser score or state | Ignore client state; server recomputes all actions and totals |
| Forged player ownership | Cryptographically random opaque session token; ownership check on every private operation |
| Session theft/leakage | Secure, HttpOnly, SameSite cookie; hash stored token; avoid log leaks |
| CSRF on mutations | Origin checks, SameSite cookies and appropriate CSRF defense |
| Replay / double click | Idempotency action ID + versioned transactional update |
| Racing tabs | Row lock or atomic guarded update; conflict 409 and refetch |
| Malformed or oversized input | Runtime schema validation and strict bounds |
| Enumeration and scraping | Bounded leaderboard pages and rate limits |
| Fake arcade high-score claim | Authenticate finished run ownership, validate nickname, recompute TOP 100 cutoff atomically, ensure one claim per run |
| Nickname impersonation | Treat nickname as presentation-only; never use it as authentication or unique ownership |
| Resource exhaustion / bots | Rate limits, compute budgets, suspicious play heuristics, monitoring |
| Database error | Rollback, safe error, retry only if idempotent |
| Asset copyright claims | Audit and clear rights before serving extracted media |

## Secrets and environments

- Keep DB URLs, auth secrets and migration credentials on the server, in environment variables only.
- Use separate Preview and Production data; do not connect tests to production.
- Avoid returning rules/solver path/seed or internals not required for UI. Note that visible positions and public move outcomes inevitably give players information; do not pretend client-side concealment fully stops scripts.
- Disable or restrict debug/testing routes in production (existing debug/solver pages currently reject production via `notFound()`).
- Never grant score credit for migrated browser data, uncommitted states, or partially failed transactions.

## Verification requirements

Include focused tests for foreign run IDs, forged action payloads, duplicate IDs, reused IDs with changed payload, stale versions, concurrent continue, invalid cookie, expired session, reward once, and untrusted client values.

Related: #32, #33, #36–#43, #51.
