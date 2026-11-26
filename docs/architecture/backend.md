# Backend and transport

One Next.js application uses Vercel, Neon PostgreSQL, Drizzle and pg. [Status](status.md) separates source from deployed verification; [API contract](api-contract.md) specifies requests and recovery. The final four-table storage model is in [data model](data-model.md).

## Ownership

| Layer | Responsibility |
| --- | --- |
| `src/app/api/` | Thin HTTP and authenticated WebSocket routes |
| `src/server/game/` | Validation, ownership, transitions, batching and current-state persistence |
| `src/server/db/` | Four-table schema, pooling and bounded expiry cleanup |
| `src/server/leaderboard/` | Qualification, atomic nickname claim, live reads and shared limits |
| `src/game/` | Pure puzzle rules, generation and rewards |
| `src/client/game/` | Lifecycle/recovery, socket queue and visual prediction |
| `src/features/gameplay/` | Existing presentation, controls and dialogs |

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/players/session` | Bootstrap anonymous cookie; exact body `{}` |
| POST | `/api/runs` | Create with action ID; retain only action/run UUID marker |
| GET | `/api/runs/current` | Current unexpired active run or null |
| GET | `/api/runs/:id` | Owned unexpired active game or terminal summary |
| POST | `/api/runs/:id/move` | Versioned plate slide intent |
| POST | `/api/runs/:id/reset` | Reset positions, preserving damage and penalties |
| POST | `/api/runs/:id/continue` | Credit pending reward once and generate next chest |
| POST | `/api/runs/:id/abandon` | End game and discard pending reward |
| GET | `/api/runs/:id/leaderboard-eligibility` | Current owned qualification; no reservation |
| POST | `/api/runs/:id/leaderboard-entry` | Nickname/action ID only; atomic cutoff recheck |
| GET | `/api/leaderboard` | Public live TOP1000 pages |
| GET upgrade | `/api/game/socket?run=:id` | Same-origin authenticated socket for one owned run |
| GET | `/api/maintenance/cleanup` | Server-secret-authenticated physical expiry cleanup |

## Atomic actions and recovery

Owner-first session locks serialize gameplay, create identity, private claims and cleanup. Ownership, expiry, strict input, version and status guards run before mutation. Scores/resources always derive from server state; browser prediction is rendering only.

No response-history table exists. Existing-run retries keep the original expected version; stale requests conflict and load current authoritative state. Creation retains a small accepted action/run UUID map through the session lifetime, so delayed retries cannot recreate deleted/expired games. Accepted nickname claims retain action/rank on their immutable result row. No claim, chest reward or run can be duplicated by an uncertain response.

Adjacent socket moves batch up to 32 inputs per transaction. Each accepted input increments version/metrics; the final state is written once. Replies follow commit; unexpected persistence errors roll back the batch. HTTP fallback uses the same version rules. Reconnect conflicts clear speculative inputs. The client resumes restart after a lost abandonment response by reading current state, without replaying a reward or creating an extra game.

## Terminal results and eligibility (#39)

The last pick's fourth invalid move finalizes the game. A database trigger derives a compact summary and immediately clears puzzle JSON. Global totals update once in the same transaction. Abandonment also clears its puzzle and counts separately. Expired unfinished games are excluded from those totals.

Immediate responses can display the final layout already held in RAM. A fresh terminal read reconstructs the existing DTO with summary values and an empty board. Terminal summaries remain privately readable/claimable for 24 hours, subject to a valid owner session. Active games expire seven days after an accepted action; fixed session lifetime remains 30 days. Full terminal games are not retained until session expiry.

## Ranking integration

Game Over requests eligibility before displaying the existing nickname form. Claimed finished runs rank within the current cohort by ore DESC, opened chests DESC, finish time ASC and UUID ASC, capped at1000. A cohort transaction lock serializes cutoff checks and accepted insertion across owners. Database validation copies result fields from the compact authoritative summary; no supplied score is trusted. Permanent run UUID identity prevents repeat claims, including displaced entries.

Live public pages read compact entries directly; claims can shift rows between pages. Compact entries survive temporary summary/session deletion. Shared admission uses atomic fixed-window counters on existing session/global rows, committed before service work. There is no separate quota table or process-local substitute.

## Expiry and rollout

Reads enforce expiry immediately. Authenticated daily cleanup physically deletes expired runs and empty expired sessions, matching owner-first lock order and bounded work. It does not delete compact claims or global totals. The cron-only Vercel configuration leaves dashboard Build Command unchanged.

The final 0005 migration is intentionally incompatible with old history/full-terminal code. The runner refuses an unattended existing-database switch without explicit STORAGE_CUTOVER=1. Prepare a backup/new release and stop old writers for cutover. No live migration or deployment is implied by implementation. See [setup](server-setup.md) and [rollback limits](data-model.md#migration-and-controlled-cutover).
