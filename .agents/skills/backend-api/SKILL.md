---
name: backend-api
description: Use when implementing Next.js Route Handlers, sessions, server-authoritative run transitions, validation, security and leaderboard read APIs.
---

# Backend API skill

Read `AGENTS.md`, `docs/architecture/backend.md`, `security.md` and `data-model.md`. **Target backend is not yet implemented** on current master.

## Procedure

1. Define small request/response schemas for actions; reject caller-provided score, currentLock and player ownership fields.
2. Authenticate via Secure HttpOnly cookie, check origin/CSRF and run ownership; nickname is not identity.
3. Keep route handler thin; call domain service backed by transaction. Use input validation, version checks and idempotency action IDs.
4. Apply existing pure `src/game/*` functions on the server; persist confirmed updated state and counters atomically.
5. Return 400/401/403/404/409/429 or 5xx as appropriate with safe, actionable errors. A 409 should let the UI refetch authoritative state.
6. Do not trust in-memory Maps across Vercel Functions or claim WebSockets make the endpoint secure.
7. Test authorization, double submission, stale version, concurrent requests and DB rollback.

## Done when

- A browser can only submit action intent; state and score are produced server-side.
- Replays and simultaneous requests cannot credit a chest twice.
- Client-bundle dependency graph contains no DB secrets or internal solver data.
