# Target backend and API contract (not yet implemented)

The canonical v1 wire contract is [api-contract.md](api-contract.md), with shared TypeScript DTOs in [`src/api/contracts.ts`](../../src/api/contracts.ts). It defines exact requests, responses, lifecycle, errors and replay behavior for #29. Endpoints below remain unimplemented; session bootstrap is still owned by #33.

## Layers and boundaries

```text
src/app/api/.../route.ts       -> validation, session, HTTP response
src/server/game/*              -> authorization, run orchestration, transactions
src/server/db/*                -> Drizzle schema and repository queries
src/game/*                     -> pure engine, no I/O
src/components/game/*          -> client UI, intent/response presentation
```

Paths under `src/server` and `src/app/api` are **proposed**, not confirmed existing. Keep route handlers thin and avoid importing server-only DB modules into client bundles.

## Contract endpoints

| Method | Path | Semantics |
| --- | --- | --- |
| POST | `/api/players/session` | Start/restore anonymous session (exact route TBD) |
| POST | `/api/runs` | Start a new run under authenticated session |
| GET | `/api/runs/current` | Resume active run |
| GET | `/api/runs/:id` | Read an owned run, including a terminal result |
| POST | `/api/runs/:id/move` | Apply one pin movement |
| POST | `/api/runs/:id/reset` | Reset current lock positions, preserving penalties |
| POST | `/api/runs/:id/continue` | Claim solved chest once and advance |
| POST | `/api/runs/:id/abandon` | Explicitly end an active run without ranking credit |
| GET | `/api/leaderboard` | Public ranked scores, paginated, capped TOP 100 |

All mutating payloads use strict schemas. Move requests contain exactly `pinId`, `direction`, `actionId`, `expectedVersion` (never ore, lock state or player ID). Reset/continue/abandon contain only `actionId` and `expectedVersion`; creation contains only `actionId`. Responses contain full public run snapshots, versions and presentation outcomes. See the canonical contract for nullability, samples and status-specific reward/result fields.

## Transition template

1. Validate schema, authentication, CSRF/origin and ownership.
2. Use a DB transaction with a guarded row update / appropriate lock or compare-and-swap, backed by a version field.
3. Check duplicate `actionId` to return the prior committed response for exact retries, before testing version or run status. Reject changed payloads under the same key.
4. Check expected version and legal run status, then run the pure domain transition and calculate any reward server-side.
5. Persist run, counters and action result atomically. Commit and return **confirmed** state.
6. If version is stale, return HTTP `409` with a recoverable conflict response; client refetches before continuing.

The precise Drizzle/Neon driver and transaction style must be tested with PostgreSQL integration tests, especially on Vercel; do not assume all serverless transport modes have identical transaction behavior (#32).

## Operational concerns

- Node.js function environment; no assumption of a persistent in-memory session map.
- Environment variables only on server; never prefix secret values with `NEXT_PUBLIC_`.
- Preview and Production must have isolated databases; migrations controlled explicitly.
- Monitor latency, Vercel function consumption and Neon compute wakeup; benchmark late-game lock generation (#28).
- Do not run expensive solver searches on every player move if a cheaper validated state transition suffices.
- Validate bounds, rate limit, handle timeouts and connection errors; no silent client-side fallbacks for authoritative actions.
