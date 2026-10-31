# Gameplay API contract — v1

This is the implementation contract for [issue #29](https://github.com/begiedz/wedges-trial/issues/29), not a deployed API. The existing local game remains unchanged. Shared wire types live in [`src/api/contracts.ts`](../../src/api/contracts.ts); they are types, **not runtime validators**. Route implementation must strictly validate incoming JSON. Session creation, database orchestration, scoring and client migration remain in their respective issues.

## Transport and identity

- Same-origin HTTPS JSON under `/api`, outside the localized `/{lang}` page tree. Requests with bodies use `Content-Type: application/json`; responses use `application/json`.
- All run endpoints require a valid anonymous session cookie. Session bootstrap and nickname validation belong to #33–#34; no gameplay endpoint implicitly creates an identity. Secure, HttpOnly, SameSite cookie configuration belongs to that implementation.
- Every mutation requires an allowed same-origin `Origin`; missing or disallowed origins return `403 ORIGIN_FORBIDDEN`. Non-browser callers must supply the same origin and valid session. All private reads and mutations check ownership.
- Missing, expired or revoked sessions return `401 SESSION_REQUIRED`. An unknown run and a run belonging to someone else both return `404 RUN_NOT_FOUND`, without disclosing its status, version or owner. UUIDs are identifiers, not authorization.
- Run responses and errors use `Cache-Control: no-store`. Public leaderboard reads do not require a session and also use `no-store` in v1.
- Timestamps are UTC ISO 8601 strings. IDs and `actionId` are UUID strings. JSON numbers used for counts, indices and versions must be finite safe integers. Resource counts are nonnegative; `chestIndex` and run versions start at 1.
- Reject unknown body/query fields, invalid JSON, incorrect types, invalid UUIDs and unsupported values with `400 INVALID_REQUEST`. Never accept `playerId`, score, resources, reward, lock state, rules, seed, timestamps or solver data in a mutation body. Implementations must bound request sizes and rate-limit requests; operational thresholds remain in #43.

## Endpoints and payloads

The path `:id` is a run UUID. `RunActionRequest` means **exactly** `{ actionId, expectedVersion }`, where `expectedVersion >= 1`. `StartRunRequest` is exactly `{ actionId }`: there is no run version before creation. Reset, continue and abandon accept no other fields.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| POST | `/api/runs` | `StartRunRequest` | `201 StartRunResponse` |
| GET | `/api/runs/current` | No body or query | `200 CurrentRunResponse` |
| GET | `/api/runs/:id` | No body or query | `200 RunResponse` |
| POST | `/api/runs/:id/move` | `MoveRequest` | `200 MoveResponse` |
| POST | `/api/runs/:id/reset` | `RunActionRequest` | `200 ResetRunResponse` |
| POST | `/api/runs/:id/continue` | `RunActionRequest` | `200 ContinueRunResponse` |
| POST | `/api/runs/:id/abandon` | `RunActionRequest` | `200 AbandonRunResponse` |
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
| `difficulty` | Server-derived display band: 1, 2, 3 or 4 |
| `currentLock` | Visible pins (`id`, `position`, `target`, `min`, `max`), current pick damage and literal `maxInvalidMovesPerPick: 3` |
| `reward` | Non-null only in `chest_opened`: fixed pending `{ oreNuggets, lockpicks }` |
| `result` | Non-null only in `finished`: immutable final ore, solved-chest count, finish time and `reason: "lockpicks_exhausted"` |
| `createdAt`, `updatedAt` | Server timestamps; `updatedAt` changes with committed mutations |

Use `status` instead of redundant `isSolved`/`isFailed` flags. Dependency rules, generation seed, initial lock, solver path/optimum and session/player credentials are never serialized. Changed pin highlights can be derived by comparing public snapshots. Terminal snapshots retain the last visible lock for display. Scores from old local saves are never imported into this API.

`playing` requires at least one pick and an unsolved lock. `chest_opened` requires all pins on target and at least one pick. `finished` requires zero picks and matching run/result totals. `openedChests === chestIndex - 1` while playing/finished; it equals `chestIndex` in `chest_opened`. An abandoned run preserves its last chest/solved count, including a solved-but-unclaimed chest. All pin positions and targets remain within their declared bounds.

### Moves, rewards and reset

`MoveRequest` adds a nonnegative integer `pinId` and literal `direction: -1 | 1`. An ID absent from the owned current lock returns `400 INVALID_PIN`. Direction follows engine deltas, not screen orientation; the UI adapts its controls.

An out-of-bounds move is a **successful gameplay action**, `200` with `outcome: "invalid_move"`, rather than an HTTP validation error. It preserves all pin positions, adds damage and increments the version. The third invalid move consumes exactly one pick and resets current-pick damage to 0. Return `pick_broken` if picks remain, or `run_finished` if none remain. No pin reset occurs. Valid moves return `moved`, or `chest_opened` when all targets are reached. Outcome precedence is therefore `run_finished` over `pick_broken` over `invalid_move`, and `chest_opened` over `moved`.

The solving move increments `openedChests`, calculates and persists a pending reward and changes status to `chest_opened` in one transaction. The reward is shown immediately and is stable across reads, refreshes and retries. It is **not yet credited** to resource totals. The exact ore formula, efficiency penalties and pick-replenishment schedule remain open in #47/#49/#51; example numbers here are illustrative only.

`/continue` is allowed only in `chest_opened`. In one transaction, it credits the stored reward exactly once, generates the next solvable lock, increments `chestIndex`, resets per-chest counters and changes status to `playing` with `reward: null`. It returns the credited amounts separately as `claimedReward` for feedback. It preserves current-pick damage unless a future explicit gameplay decision changes that rule. If lock generation or persistence fails, no part is committed; the pending reward and version stay unchanged. Do not generate or award anything in the browser.

`/reset` is allowed only in `playing`. It restores initial pin positions, preserving pick damage, spent picks, ore, run totals and cumulative per-chest move/invalid/broken-pick penalties. It cannot erase performance penalties, reroll a lock or reward, or reset a solved/terminal chest. A reset is an accepted versioned action even when pins are already in their initial positions.

### Lifecycle and terminal states

| Before | Action | After | Atomic effects |
| --- | --- | --- | --- |
| No active run | Create | `playing` | New ID, version 1, server lock/resources |
| `playing` | Valid unsolved move | `playing` | Update affected pins and counters |
| `playing` | Invalid move, picks remain | `playing` | Damage/break a pick; preserve pin positions |
| `playing` | Solve | `chest_opened` | Record pending reward, increment opened count |
| `playing` | Reset | `playing` | Restore positions only |
| `chest_opened` | Continue | `playing` | Credit once and advance chest |
| `playing` | Last pick breaks | `finished` | Persist final result, resources and finish time |
| `playing` or `chest_opened` | Abandon | `abandoned` | Discard pending reward; preserve credited totals |

All other action/status combinations return `409 INVALID_RUN_STATUS` without mutation. Finished and abandoned runs are immutable. There is no client-submitted `/finish` or score endpoint: breaking the last pick finalizes the run in the same transaction. Only server-verified `finished` runs are eligible for ranking; unfinished and abandoned runs are excluded. Abandoning an opened chest does not credit its reward. A new game after finish needs no abandon confirmation or abandonment request.

## Versions, duplicate actions and recovery

1. Every mutation has a caller-generated `actionId`; the client retains the exact request until the outcome is known. Scope action IDs uniquely **per player across all mutation endpoints**, including create. Reusing an ID for a different route/run/body returns `409 ACTION_ID_REUSED`.
2. Authenticate, validate schema/origin and authorize access before serving a replay. Within the transaction, check the action record **before** checking the current version or lifecycle. An exact duplicate of a committed request returns its original status code and JSON, including the original snapshot/version, even after the run has advanced or finished. It never creates another lock, credits again, or increments version. Creation retries return the same `201` and ID.
3. A new action on an existing run requires `expectedVersion === current version`. Mismatch returns `409 VERSION_CONFLICT` with authorized `runId`, `currentVersion`, `currentStatus`. No pins, damage, resources, metrics, reward or action success record changes.
4. For matching versions, verify legal status and action, then atomically commit state, counters, version `+1`, and replay record. Successful invalid moves and resets also consume a version. Errors consume no version and do not reserve action IDs. Concurrent identical requests wait/re-read the one committed result; concurrent different requests from one version allow at most one commit.
5. Action deduplication and state changes require a database transaction/constraints, not an in-memory map. Keep successful replay records for as long as the run is available; retention/tombstones must prevent old IDs from executing again. The existing proposed `(run_id, action_id)` constraint alone cannot cover create or cross-run reuse: #31–#32 must also enforce `UNIQUE(player_id, action_id)` or an equivalent atomic design. A committed creation action references the newly generated run ID; the caller need not know that ID to retry creation.
6. After timeout, network loss, `429` or `5xx`, retry the **same** action ID/body (respecting `Retry-After`). Do not generate a fresh ID while commit status is unknown. A crash after commit but before response must still replay the committed result.
7. After a conflict, stop queued gameplay input and fetch `/api/runs/:id`; `/current` may be null if another tab ended the run. Replace stale state with the authoritative snapshot. Do not automatically reapply a move/reset/continue with a new version; a new deliberate action gets a fresh ID.
8. A replay may carry an older snapshot than the UI already has. Never replace a higher version of the same run with a lower version. After a delayed response, refetch if needed. Responses for a previously active run must not replace a newer selected run. No optimistic score/pick awards or local authoritative fallback.

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

The API is locale-neutral: do not require a `locale` mutation field or change payloads with `Accept-Language`. The frontend maps every known error code, outcome and status to dictionary keys for **en/pl/de/ru**, with English fallback and a generic fallback for unknown codes. Nicknames are rendered as plain text. Language switching never creates a run or repeats a mutation. Existing dictionaries are unchanged by this contract-only issue; localized API feedback is implemented with #40.

## Leaderboard read contract

`GET /api/leaderboard?limit=25&cursor=...` accepts a decimal integer `limit` from 1 to 100 (default 25) and an optional opaque server-issued cursor. Unknown query fields, duplicate parameters and invalid limits return `400 INVALID_REQUEST`; malformed/tampered/expired cursors return `400 INVALID_CURSOR`. A rejected cursor is restarted with a cursorless read.

Use #24's current ranking contract: one best **finished** run per player, ordered by `oreNuggets DESC`, then `openedChests DESC`, `finishedAt ASC`, stable `runId ASC`. Apply the same ordering to select each player's best run and to the global ranking, capped at 100. Only the server's current eligible `rulesetVersion` appears in a response. Any scoring/ranking redesign in #51 must revise this contract/version before implementation; this issue defines no reward coefficients.

Each cursor binds the initial read's **frozen ordered TOP 100 result set**, current ruleset and last emitted row/rank. Later finishes cannot reorder that traversal, replace a player's chosen run or change its display name between pages. Rank is the 1-based position within that snapshot. #24/#32 must implement durable snapshot semantics (for example, persisting the bounded selected rows) rather than a process-local map; a timestamp cutoff alone is insufficient when transactions can commit later with earlier timestamps. The snapshot storage/retention mechanism is an implementation detail; an expired snapshot returns `INVALID_CURSOR`. Return `nextCursor: null` at the end, including empty results and the TOP 100 boundary; the last page may be shorter than `limit`. Cursors are opaque to the browser; do not expose session or player credentials. A cursor for a retired ruleset is invalid rather than mixing score systems.

```json
{
  "rulesetVersion": "example-v1",
  "entries": [
    {
      "rank": 1,
      "runId": "20d4e876-23ba-4c29-a970-4ad4ff562e70",
      "displayName": "Wedge",
      "oreNuggets": 120,
      "openedChests": 8,
      "finishedAt": "2026-10-31T12:10:00.000Z"
    }
  ],
  "nextCursor": null
}
```

## Sample requests and confirmed responses

Values are illustrative, not balance decisions. A one-pin lock keeps the examples readable; production generation follows the domain difficulty configuration.

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
      "maxInvalidMovesPerPick": 3
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
      "maxInvalidMovesPerPick": 3
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
      "maxInvalidMovesPerPick": 3
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
  "finishedAt": "2026-10-31T12:10:00.000Z",
  "reason": "lockpicks_exhausted"
}
```

## Implementation handoff and checks

- #31–#33: session ownership, one-active-run constraint, player-scoped action identity including create, atomic replay/version storage and retention.
- #35–#39: generate/restore, versioned moves, safe reset, stored pending reward and atomic claim, final result and abandonment.
- #40–#42: full-snapshot rendering, retry identity, stale-response protection, four-language feedback, integration/concurrency tests; remove legacy saves only when server flow works.
- #24/#46: snapshot-stable, ruleset-aware ranking query and cursor validation.
- Test exact replay before stale-version/status checks, key reuse with changed payload, two different actions at one version, simultaneous start/claim/finalization, cross-player IDs, missing/bad origins, third invalid move, reset preserving penalties, failure rollback, abandoned reward exclusion and terminal reads. Contract/types alone do not establish any of these server guarantees.
