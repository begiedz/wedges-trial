# Gameplay API contract — v1

This is the v1 gameplay contract. Session/gameplay HTTP endpoints, WebSockets and private leaderboard eligibility/claims are implemented; the public leaderboard read is implemented under #24. See [status](status.md) for verification boundaries. Shared wire types live in [contracts.ts](../../src/api/contracts.ts) and [realtime.ts](../../src/api/realtime.ts); runtime validation lives in src/server/game/validation.ts.

Product explanations use [plates for moving elements and pins for fixed indicators](gameplay.md#lock-component-terminology-60). Existing wire fields (`pins`, `pinId`, position/target/range and movement rules) encode plate alignment and retain their names. No DTO or persisted-state rename is implied.

## Transport and identity

- Same-origin HTTPS JSON under `/api`, outside the localized `/{lang}` page tree. Requests with bodies use `Content-Type: application/json`; responses use `application/json`.
- All run endpoints require a valid anonymous session cookie. POST /api/players/session accepts exactly {} and returns { "ready": true }, setting a Secure, HttpOnly, SameSite=Strict cookie when needed. The session has a fixed 30-day expiry; only the token hash is stored. No gameplay endpoint implicitly creates a session. Post-run claim endpoints use the same owner; localized Game Over nickname entry is implemented under #34.
- Every mutation requires an allowed same-origin `Origin`; missing or disallowed origins return `403 ORIGIN_FORBIDDEN`. Non-browser callers must supply the same origin and valid session. All private reads and mutations check ownership.
- Missing, expired or revoked sessions return `401 SESSION_REQUIRED`. An unknown run and a run belonging to someone else both return `404 RUN_NOT_FOUND`, without disclosing its status, version or owner. UUIDs are identifiers, not authorization.
- Run responses and errors use `Cache-Control: no-store`. Public leaderboard reads do not require a session and also use `no-store` in v1.
- Timestamps are UTC ISO 8601 strings. IDs and `actionId` are UUID strings. JSON numbers used for counts, indices and versions must be finite safe integers. Resource counts are nonnegative; `chestIndex` and run versions start at 1.
- Reject unknown body/query fields, invalid JSON, incorrect types, invalid UUIDs and unsupported values with `400 INVALID_REQUEST`. Never accept `playerId`, score, resources, reward, lock state, rules, seed, timestamps or solver data in a mutation body. Implementations must bound request sizes and rate-limit requests; operational thresholds remain in #43.

## Endpoints and payloads

The path `:id` is a run UUID. `RunActionRequest` means **exactly** `{ actionId, expectedVersion }`, where `expectedVersion >= 1`. `StartRunRequest` is exactly `{ actionId }`: there is no run version before creation. Reset, continue and abandon accept no other fields.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| POST | `/api/players/session` | Exactly `{}` | `200 { "ready": true }` |
| POST | `/api/runs` | `StartRunRequest` | `201 StartRunResponse` |
| GET | `/api/runs/current` | No body or query | `200 CurrentRunResponse` |
| GET | `/api/runs/:id` | No body or query | `200 RunResponse` |
| POST | `/api/runs/:id/move` | `MoveRequest` | `200 MoveResponse` |
| POST | `/api/runs/:id/reset` | `RunActionRequest` | `200 ResetRunResponse` |
| POST | `/api/runs/:id/continue` | `RunActionRequest` | `200 ContinueRunResponse` |
| POST | `/api/runs/:id/abandon` | `RunActionRequest` | `200 AbandonRunResponse` |
| GET | `/api/runs/:id/leaderboard-eligibility` | No body or query | `200 LeaderboardQualification` |
| POST | `/api/runs/:id/leaderboard-entry` | Exactly `{ actionId, nickname }` | `200 LeaderboardClaimResponse` |
| GET | `/api/leaderboard` | `limit`, `cursor` query parameters | `200 LeaderboardResponse` |

The by-ID read and abandon mutation complete the requested lifecycle: `/current` cannot reload a finished result, and starting a run must not silently abandon another one.

### Start and restore

`POST /api/runs` generates a fresh lock server-side at version 1. It returns `409 ACTIVE_RUN_EXISTS` if the player already has a `playing` or `chest_opened` run. One active run per player is enforced atomically, including simultaneous creates with different action IDs. Existing terminal runs are retained; a new run never overwrites them. Confirm abandonment in the UI before calling `/abandon`, then create with a new action ID. If creation fails after abandonment, retry creation; abandonment and creation are separate explicit actions.

`GET /api/runs/current` returns the active run, or `{ "run": null }` when there is none, including after finish/abandon. Absence is `200`, not `404`. The by-ID read returns an owned run in any status, allowing result refresh and recovery after another tab ends a run. Neither read changes state or version.

### Public run representation

Every run response includes the entire confirmed public snapshot, not a patch:

| Field | Meaning |
| --- | --- |
| `id`, `version` | Run identity and committed concurrency version |
| `rulesetVersion` | Server-assigned ruleset identifier; examples do not freeze a scoring formula |
| `status` | `playing`, `chest_opened`, `finished` or `abandoned` |
| `chestIndex` | 1-based current chest, or last attempted chest after termination |
| `openedChests` | Number of solved locks; increments on solving, not on claim/retry |
| `oreNuggets`, `lockpicks` | Credited resources only; pending rewards are excluded |
| `difficulty` | Server-derived tier: 1, 2, 3 or 4; learning-ramp-v1 classifies immutable initial connections, older cohorts retain their chest-based bands |
| `currentLock` | Visible plate alignment in `pins` (`id`, `position`, `target`, `min`, `max`), current pick damage and literal `maxInvalidMovesPerPick: 4` |
| `reward` | Non-null only in `chest_opened`: fixed pending `{ oreNuggets, lockpicks }` |
| `result` | Non-null only in `finished`: immutable final ore, solved-chest count, cumulative `totalMetrics: { moves, invalidMoves, brokenPicks }`, finish time and `reason: "lockpicks_exhausted"` |
| `createdAt`, `updatedAt` | Server timestamps; `updatedAt` changes with committed mutations |

Final statistics include every processed valid/invalid move and all broken picks across chests and resets. They are read-only server projections, not accepted mutation fields. Historical stored action replies can omit `result.totalMetrics`; replay them unchanged and show unavailable statistics until a fresh owned read supplies totals. Current-pick damage is durability, not cumulative mistake history.

Use `status` instead of redundant `isSolved`/`isFailed` flags. Optional currentLock.moveRules exposes public movement mechanics to the owner for visual prediction. Generation seed, initial lock, solver path/optimum and session/player credentials are never serialized. Changed plate highlights can be derived by comparing public snapshots. Immediate terminal responses may retain the last visible lock in RAM. Reloaded terminal summaries use an empty lock; no final layout is saved. Scores from old local saves are never imported into this API.

`playing` requires at least one pick and an unsolved lock. `chest_opened` requires all plates aligned with their targets and at least one pick. `finished` requires zero picks and matching run/result totals. `openedChests === chestIndex - 1` while playing/finished; it equals `chestIndex` in `chest_opened`. An abandoned run preserves its last chest/solved count, including a solved-but-unclaimed chest. All plate alignment positions and targets remain within their declared bounds.

### Moves, rewards and reset

`MoveRequest` adds a nonnegative integer `pinId` and literal `direction: -1 | 1`. An ID absent from the owned current lock returns `400 INVALID_PIN`. Direction follows engine deltas, not screen orientation; the UI adapts its controls.

An out-of-bounds move is a **successful gameplay action**, `200` with `outcome: "invalid_move"`, rather than an HTTP validation error. It preserves all plate positions, adds damage and increments the version. The fourth invalid move consumes exactly one pick and resets current-pick damage to 0. Return `pick_broken` if picks remain, or `run_finished` if none remain. No plate reset occurs. Valid moves return `moved`, or `chest_opened` when all targets are reached. Outcome precedence is therefore `run_finished` over `pick_broken` over `invalid_move`, and `chest_opened` over `moved`.

The solving move increments `openedChests`, calculates and persists a pending reward and changes status to `chest_opened` in one transaction. The reward is shown immediately and is stable across reads, refreshes and retries. It is **not yet credited** to resource totals. Approved deterministic-ore-v1 awards floor((10 + 5 * (chestNumber - 1)) * max(4, 10 - invalidMovesOnChest) / 10). New `learning-ramp-v1` and saved `scarce-picks-v1` runs start with one pick and use 79%/17%/4% drops for 0/1/2 picks. Saved `deterministic-ore-v1` runs and pending rewards retain their original balance. Example snapshots are illustrative.

`/continue` is allowed only in `chest_opened`. In one transaction, it credits the stored reward exactly once, generates the next solvable lock, increments `chestIndex`, resets per-chest counters and changes status to `playing` with `reward: null`. It returns the credited amounts separately as `claimedReward` for feedback. It preserves current-pick damage unless a future explicit gameplay decision changes that rule. If lock generation or persistence fails, no part is committed; the pending reward and version stay unchanged. Do not generate or award anything in the browser.

`/reset` is allowed only in `playing`. It restores initial plate positions, preserving pick damage, spent picks, ore, run totals and cumulative per-chest move/invalid/broken-pick penalties. It cannot erase performance penalties, reroll a lock or reward, or reset a solved/terminal chest. A reset is an accepted versioned action even when plates are already in their initial positions.

### Lifecycle and terminal states

| Before | Action | After | Atomic effects |
| --- | --- | --- | --- |
| No active run | Create | `playing` | New ID, version 1, server lock/resources |
| `playing` | Valid unsolved move | `playing` | Update affected plate positions and counters |
| `playing` | Invalid move, picks remain | `playing` | Damage/break a pick; preserve plate positions |
| `playing` | Solve | `chest_opened` | Record pending reward, increment opened count |
| `playing` | Reset | `playing` | Restore positions only |
| `chest_opened` | Continue | `playing` | Credit once and advance chest |
| `playing` | Last pick breaks | `finished` | Persist final result, resources and finish time |
| `playing` or `chest_opened` | Abandon | `abandoned` | Discard pending reward; preserve credited totals |

All other action/status combinations return `409 INVALID_RUN_STATUS` without mutation. Finished and abandoned runs are immutable. There is no client-submitted `/finish` or score endpoint: breaking the last pick finalizes the run in the same transaction. Only server-verified `finished` runs are eligible for ranking; unfinished and abandoned runs are excluded. Abandoning an opened chest does not credit its reward. A new game after finish needs no abandon confirmation or abandonment request.

## Versions, duplicate actions and recovery

Existing-run actions (move/reset/continue/abandon) retain original action ID, body and expected version on retry. No full historical response is recorded. At most one request at a version commits; stale retries return 409 and reload current state. Never substitute a new version into an old intent. Successful invalid moves and resets consume a version; rejected actions do not.

Creation stores only the accepted action/run UUID pair on its owning session. Repeating the create returns current retained state of that run; an expired/deleted original returns 404 rather than creating another game. No historical creation snapshot is replayed. Concurrent distinct creates still allow only one active run.

An accepted nickname claim stores action ID and original accepted rank on its immutable compact entry. Identical action/name retries return that entry while the source summary is available; changed use of a recorded claim action ID conflicts. Rejected qualification attempts may be evaluated again, not historically replayed. One run can claim once permanently.

Authentication, expiry and ownership precede access. Conflict recovery clears speculative inputs and reads the owned run. Terminal summaries expire 24 hours after termination; active games expire seven days after the last accepted action. Expired private reads/claims return 404. Session expiry/revocation remains 401. Never regress a newer confirmed state when older network replies arrive.

## WebSocket protocol (implemented)

GET /api/game/socket?run=<UUID> upgrades an authenticated same-origin connection. It accepts exactly one run query parameter and checks Origin, cookie expiry and ownership before upgrade. Other HTTP gameplay routes reject query fields. The socket is bound to that run; it cannot switch ownership/run through a message.

Client action frame:

~~~json
{"type":"action","runId":"<UUID>","action":"move","body":{"actionId":"<UUID>","expectedVersion":1,"pinId":0,"direction":1}}
~~~

The same strict action validators apply. The protocol also supports reset/continue/abandon with their standard bodies; the current UI uses HTTP lifecycle controls after queued moves drain. Server frames are ready {run}, result {actionId,response}, error {actionId?,status,error}, and ping. The client answers {"type":"pong"}. Error/result fields follow the HTTP contract.

Results are sent only after commit, in action order. Adjacent moves batch up to 32 per transaction, returning each accepted action's version and result without storing move history. Frames are limited to 2 KiB; binary/oversized frames close with 1009. More than 120 messages/second or 128 queued commands closes with 1008; excessive outgoing buffering closes with 1013. Heartbeats run every 20 seconds; stale pong over 60 seconds or session expiry closes with 4001. These per-connection limits do not implement distributed rate limiting.

The client buffers up to 64 inputs, predicts visuals immediately, and reconciles against committed snapshots. It pauses after a predicted solved/failed lock until confirmation. Resources and terminal dialogs remain confirmed. Reconnect preserves unknown action IDs/versions; conflicts discard queued predictions and refetch. HTTP fallback uses the same authority and version-recovery rules. Function duration is bounded (300-second setting), so reconnect is expected.

## Errors and localization

All application errors use this shape; do not return raw DB errors, stack traces, request values or English-only display messages:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "requestId": "7be37bfd-a139-42db-9ae5-edac1599dff0",
    "runId": "20d4e876-23ba-4c29-a970-4ad4ff562e70",
    "currentVersion": 8,
    "currentStatus": "playing"
  }
}
```

| HTTP | Codes | Client behavior |
| --- | --- | --- |
| 400 | `INVALID_REQUEST`, `INVALID_PIN`, `INVALID_CURSOR` | Correct the request; optional `fields` contains schema field names only |
| 401 | `SESSION_REQUIRED` | Re-establish session through the identity flow; do not silently create another player's run |
| 403 | `ORIGIN_FORBIDDEN` | Block mutation; show localized access error |
| 404 | `RUN_NOT_FOUND` | Clear selected private run and refetch `/current` |
| 409 | `VERSION_CONFLICT`, `INVALID_RUN_STATUS` | Include owned `runId`, `currentVersion`, `currentStatus`; refetch before another action |
| 409 | `ACTIVE_RUN_EXISTS` | Include existing owned run metadata; offer resume or explicit abandonment |
| 409 | `ACTION_ID_REUSED` | Do not retry changed payload under that ID; resolve the original action first |
| 429 | `RATE_LIMITED` | Include `Retry-After` (integer seconds); delay exact retry |
| 500 | `INTERNAL_ERROR` | Safe generic failure; retry the same action ID |
| 503 | `SERVICE_UNAVAILABLE` | Temporary DB/service outage; include `Retry-After` when known; retry same ID |

Transport/platform failures may not be JSON. Clients treat malformed/non-JSON failures as unknown outcomes and use the same retry rules. Conflict metadata appears only in the three owned-run conflict cases documented above; other errors omit it. `requestId` is an opaque support correlation ID, not a session credential.

The API is locale-neutral: do not require a `locale` mutation field or change payloads with `Accept-Language`. The frontend maps every known error code, outcome and status to dictionary keys for **en/pl/de/ru**, with English fallback and a generic fallback for unknown codes. Nicknames are rendered as plain text. Language switching never creates a run or repeats a mutation. Localized API feedback is implemented in the four dictionaries.

## Public leaderboard read contract (#24)

`GET /api/leaderboard?limit=25&cursor=...` accepts a decimal limit 1–100 (default 25) and optional server-issued cursor. The existing UI requests 10 rows. Unknown/duplicate fields and invalid limits return `400 INVALID_REQUEST`; invalid cursors return `400 INVALID_CURSOR`. Old signed snapshot cursors are rejected; restart with a cursorless read.

Each request reads a bounded page of current claimed finished runs in `all-plates-v1`: ore DESC, opened chests DESC, finish time ASC, run UUID ASC. Capacity remains TOP 1000, one entry per claimed run. Multiple runs per owner are allowed. A numeric offset cursor carries no credential or signature; bounds prevent traversal beyond the cap. `nextCursor` is null at the end, including empty results.

New claims can shift rows between requests, so pages are not a frozen historical traversal. No snapshot row or signing key is created. The DTO remains `{ rulesetVersion, entries, nextCursor }`, exposing only ranking fields. Public responses require no session and use `Cache-Control: no-store`; shared read admission remains in force.

## Sample requests and confirmed responses

Values are illustrative, not balance decisions. A one-plate lock (`pins` has one entry) keeps the examples readable; production generation follows the domain difficulty configuration.

Start request, `POST /api/runs`:

```json
{ "actionId": "870192f5-9951-4f4d-bd80-bfe7ddbe1dfa" }
```

`201` response (also the full public shape used by reads):

```json
{
  "outcome": "run_started",
  "run": {
    "id": "20d4e876-23ba-4c29-a970-4ad4ff562e70",
    "version": 1,
    "rulesetVersion": "example-v1",
    "status": "playing",
    "chestIndex": 1,
    "openedChests": 0,
    "oreNuggets": 0,
    "lockpicks": 3,
    "difficulty": 1,
    "currentLock": {
      "pins": [{ "id": 0, "position": 2, "target": 3, "min": 0, "max": 6 }],
      "invalidMovesOnCurrentPick": 0,
      "maxInvalidMovesPerPick": 4
    },
    "reward": null,
    "result": null,
    "createdAt": "2026-10-31T12:00:00.000Z",
    "updatedAt": "2026-10-31T12:00:00.000Z"
  }
}
```

Solving move request, `POST /api/runs/20d4e876-23ba-4c29-a970-4ad4ff562e70/move`:

```json
{
  "actionId": "153d8dc7-7599-487d-8615-771654849b6c",
  "expectedVersion": 1,
  "pinId": 0,
  "direction": 1
}
```

`200` response:

```json
{
  "outcome": "chest_opened",
  "run": {
    "id": "20d4e876-23ba-4c29-a970-4ad4ff562e70",
    "version": 2,
    "rulesetVersion": "example-v1",
    "status": "chest_opened",
    "chestIndex": 1,
    "openedChests": 1,
    "oreNuggets": 0,
    "lockpicks": 3,
    "difficulty": 1,
    "currentLock": {
      "pins": [{ "id": 0, "position": 3, "target": 3, "min": 0, "max": 6 }],
      "invalidMovesOnCurrentPick": 0,
      "maxInvalidMovesPerPick": 4
    },
    "reward": { "oreNuggets": 10, "lockpicks": 0 },
    "result": null,
    "createdAt": "2026-10-31T12:00:00.000Z",
    "updatedAt": "2026-10-31T12:01:00.000Z"
  }
}
```

Continue request (reset/abandon use this same two-field shape), `POST /api/runs/20d4e876-23ba-4c29-a970-4ad4ff562e70/continue`:

```json
{ "actionId": "69e94d75-6150-4a8a-b1ee-2485a08159d3", "expectedVersion": 2 }
```

`200` response:

```json
{
  "outcome": "chest_continued",
  "claimedReward": { "oreNuggets": 10, "lockpicks": 0 },
  "run": {
    "id": "20d4e876-23ba-4c29-a970-4ad4ff562e70",
    "version": 3,
    "rulesetVersion": "example-v1",
    "status": "playing",
    "chestIndex": 2,
    "openedChests": 1,
    "oreNuggets": 10,
    "lockpicks": 3,
    "difficulty": 1,
    "currentLock": {
      "pins": [{ "id": 0, "position": 1, "target": 3, "min": 0, "max": 6 }],
      "invalidMovesOnCurrentPick": 0,
      "maxInvalidMovesPerPick": 4
    },
    "reward": null,
    "result": null,
    "createdAt": "2026-10-31T12:00:00.000Z",
    "updatedAt": "2026-10-31T12:02:00.000Z"
  }
}
```

A last-pick-breaking move returns `200` with `outcome: "run_finished"`, the same full run shape, `status: "finished"`, `lockpicks: 0`, `reward: null`, and this non-null result (totals match the run):

```json
{
  "oreNuggets": 120,
  "openedChests": 8,
  "totalMetrics": { "moves": 80, "invalidMoves": 12, "brokenPicks": 4 },
  "finishedAt": "2026-10-31T12:10:00.000Z",
  "reason": "lockpicks_exhausted"
}
```

## Implementation handoff and checks

- #31–#33: session ownership, one-active-run constraint, player-scoped action identity including create, version/creation-identity protection and expiry.
- #35–#39: generate/restore, versioned moves, safe reset, stored pending reward and atomic claim, final result and abandonment.
- #40–#42: full-snapshot rendering, retry identity, stale-response protection, four-language feedback, integration/concurrency tests; remove legacy saves only when server flow works.
- #24: live, ruleset-aware ranking pages and cursor validation are implemented; deployed verification remains separate.
- Test creation/claim identity and lifecycle version resynchronization, key reuse with changed payload, two different actions at one version, simultaneous start/claim/finalization, cross-player IDs, missing/bad origins, fourth invalid move, reset preserving penalties, failure rollback, abandoned reward exclusion and terminal reads. Contract/types alone do not establish any of these server guarantees.

## Post-run arcade claims (implemented under #33)

No nickname is required for bootstrap or starting gameplay. Both private endpoints authenticate the same anonymous cookie, reject query fields, authorize the owned run and return `no-store`. Expiry/revocation is rechecked under the owner-row lock; foreign and missing runs return the same 404.

`GET /api/runs/:id/leaderboard-eligibility` returns `{ eligible: true, rank }` or `{ eligible: false, reason }`. Reasons are `invalid_run` (including active/abandoned), `unsupported_ruleset`, `already_claimed` and `below_cutoff`. This read reserves nothing.

`POST /api/runs/:id/leaderboard-entry` accepts exactly `{ actionId, nickname }`; no version or score. Nicknames are trimmed, 1–24 Unicode code points, with control characters and unpaired surrogates rejected. Names may repeat and must be rendered as plain text. Malformed requests return `400 INVALID_REQUEST`. The existing same-origin and 2 KiB body requirements apply.

Success is `200 { outcome: "leaderboard_claimed", run, entry }`, where `entry` is a `LeaderboardEntryDto` derived exclusively from the finished run and normalized name. Its rank is the rank at commit, not a reserved future place. A cutoff loss or otherwise ineligible run returns `200 { outcome: "leaderboard_not_qualified", run, qualification: { eligible: false, reason } }`. Accepted claims retain their action identity and accepted rank on the compact entry. Rejected qualification attempts may be checked again on retry. Reusing an action ID for a different run/name on a recorded accepted claim returns `409 ACTION_ID_REUSED`. Authentication and ownership precede claim identity lookup.

The transaction locks the owner, then a transaction-scoped PostgreSQL advisory lock shared by all claims in the active cohort. Under READ COMMITTED, cutoff queries after this lock see the preceding claimant's commit. Bounded TOP 1000 reads plus a separate durable claim lookup prevent displaced runs from reclaiming. Claim insertion and its compact identity/rank commit together; failure rolls them back. Accepted claims do not change the immutable run/version. All application claim writers must use this service and lock; raw SQL insertion bypasses cutoff orchestration.

The public read/cursor is implemented under #24. Game Over nickname entry is implemented under #34. Retention preserves claims permanently; private terminal summary/claim access lasts 24 hours, bounded by session validity; see [data model](data-model.md#physical-cleanup).

## Leaderboard admission and caching (#46)

All three leaderboard HTTP endpoints enforce PostgreSQL-backed request budgets across function instances. Each operation has a fixed 60-second window beginning with its first admitted request, measured by the database clock. Atomic row updates admit at most the configured count; denial does not extend the window. Defaults are operational safeguards, not measured release capacity or gameplay fairness rules:

| Requests | Scope | Default/window | Environment override |
| --- | --- | --- | --- |
| All public GET pages | Global | 600 | `LEADERBOARD_PAGES_PER_MINUTE` |
| Private eligibility GET | Authenticated session across all runs | 30 | `LEADERBOARD_ELIGIBILITY_PER_MINUTE` |
| Private claim POST, including exact retries | Authenticated session across all runs | 10 | `LEADERBOARD_CLAIMS_PER_MINUTE` |

Overrides accept decimal integers 1–999999. Invalid configuration or unavailable admission storage fails closed with the existing generic `503 SERVICE_UNAVAILABLE`. Public admission precedes query validation; private admission follows Origin/session/path checks and precedes body validation/ownership service work. Invalid requests and failed downstream work consume their admitted request. Callers cannot choose a budget key with cookies, nicknames, run IDs, query ownership fields or forwarded IP headers. Private keys derive from the authenticated session; public budgets deliberately bound total public query work without relying on proxy header trust. There is no profile or optional “my rank” API; a successful claim returns that run's rank at commit.

Exhaustion returns `429 { error: { code: "RATE_LIMITED", requestId } }` with integer `Retry-After` seconds (1–60) and `Cache-Control: no-store`. No downstream service work is performed for a denied request. Admission commits separately from claim transactions, so work rollback cannot refund requests. After waiting, retry the exact action ID/name to recover a possibly committed claim. Accepted claim identity and atomic cutoff rules still apply.

Successes and failures remain `no-store` for public and private endpoints; there is no shared HTTP/CDN cache. Counters saturate at limit + 1 and reset when their fixed window expires. They occupy fixed fields on sessions/global totals, with no key table or cleanup. No IP address is stored. Public global budgets can throttle legitimate concurrent visitors; review thresholds with measured traffic before release. These budgets do not prevent session farming, connection floods or direct platform/database exhaustion. Edge limits, session-bootstrap abuse controls, monitoring and release calibration remain #43; no anti-bot guarantee is implied.


## Temporary private data and durable results — final model

Full puzzle state is saved only while active. Terminal writes discard it immediately and keep a compact 24-hour result. Refreshing a terminal run supplies summary totals with empty pins/move rules, through the existing DTO. The immediate terminal response can still contain the final board in RAM.

Active runs expire seven days after the last accepted action. Sessions keep creation identity markers for their fixed 30-day lifetime. Compact public claimed results remain rankable independently of private summary/session expiry. Daily authenticated cleanup physically reclaims expired payloads; no full action-response history remains.

Global totals are internal; no public stats API is added. Shared read/claim/eligibility limits use fixed windows on existing global/session rows. The maintenance route authenticates with server-only CRON_SECRET, not player cookies. No frontend component or localization change is required.
