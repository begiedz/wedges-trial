# Gameplay engine and balance

The pure TypeScript engine lives in src/game/. Authoritative orchestration is in src/server/game/engine.ts; the browser uses public movement rules only for temporary rendering prediction.

## Implemented rules

- New runs start at chest 1 with 0 ore and 3 lockpicks. Locks are randomly generated from solved layouts through legal moves, with increasing progression settings.
- Each bounded integer pin has a target; fixed dependencies apply inverse effects for opposite directions. An out-of-bounds move changes no pin positions.
- Exactly three invalid moves on one pick break it. Valid moves do not heal damage; a broken pick does not reset positions. The last pick breaking atomically finishes the run.
- Manual reset restores initial pin positions, preserving partial damage, spent picks, ore and accumulated chest/run metrics. Continuing to another chest also preserves partial pick damage.
- Server metrics record moves, invalid moves and broken picks per chest and for the run. Reset does not clear them. Continue begins new chest metrics while retaining run totals.
- Solving records a stable pending reward and increments openedChests. Continue credits that reward exactly once and generates the next lock in one transaction. Abandoning an opened chest discards its pending reward.
- Difficulty display uses the same zero-based progression input as generation. Further calibration remains open.

## Approved ore formula

For deterministic-ore-v1, with 1-based chestNumber:

~~~text
base = 10 + 5 * (chestNumber - 1)
ore = floor(base * max(4, 10 - invalidMovesOnChest) / 10)
~~~

Each invalid move removes 10 percentage points of the base reward, down to a 40% floor. All invalid moves count across resets and pick breaks. Integer arithmetic avoids floating-point rounding errors. There is no excess-valid-move or unverified-optimum penalty.

Lockpick replenishment retains the previous random roll: 2 picks above 0.92, 1 above 0.58, otherwise 0. A deterministic replacement and overall sustain balance remain undecided. The legacy random-ore helper remains for debug tooling/fixtures; the authoritative game uses the approved formula.

## Lifecycle and prediction

~~~text
Session -> Create -> Playing
Playing -> Solve -> Chest opened -> Continue -> Playing
Playing -> Last pick breaks -> Finished
Playing / Chest opened -> Abandon -> Abandoned
~~~

Pins/damage render immediately through client prediction; score, rewards, resources and terminal dialogs wait for server confirmation. Moves are buffered without blocking each input on a round trip. Refresh restores committed server state, including damage and penalties.

## Solver and remaining balance work

The solver uses a bounded bidirectional breadth-first search, checked against reference BFS on seeded small locks. Generation stores `optimalMoves` only for a verified shortest path (including a shortened path’s suffix); construction-only fallback locks store `null`. This internal value is the shortest distance from the chest’s initial layout, stays fixed through moves/reset, and is absent on legacy locks. A null/absent value means unavailable, never a guessed optimum. A null solver result can mean budget exhaustion and does not prove unsolvability or an optimum. Generated locks retain solvability by construction; test actual legal solution replay. Do not penalize players against an unverified shortest path.

Measure early, threshold and high-chest generation, fallbacks and difficulty before setting new tiers or efficiency penalties. Endless remains primary; approved competitive ordering is credited ore DESC, opened chests DESC, finished time ASC, run UUID ASC. There is no v1 efficiency penalty or bounded ranked mode. See [competitive ranking](competitive-ranking.md) for qualification and sustainability. See [decisions](decisions.md), #28 and #47–#51.

## Statistics contract (#49)

`StoredGame.chestMetrics` contains `moves`, `invalidMoves` and `brokenPicks` for the current chest; `totalMetrics` contains the corresponding run totals. These are the implemented equivalents of moves/invalid moves/broken picks on the current chest, kept in server-owned state rather than duplicated in `RunState`. A processed valid or out-of-bounds move increments moves once; invalid moves also increment mistakes, and every third invalid action on the pick increments broken picks. Durability (`invalidMovesOnCurrentPick`) resets on a break; cumulative mistakes do not. Unknown pins, ignored moves, terminal moves, conflicts and exact replays add no metrics. Reset is not a move and preserves every counter; continue clears only chest counters. Reward calculation continues to use all chest mistakes.

Counters and action replay records commit together in PostgreSQL, including socket batches. The final immutable run retains totals, projected as `result.totalMetrics` and shown in Game Over in en/pl/de/ru. Historical action replies are replayed unchanged; a legacy reply without totals displays localized “Unavailable”, while a fresh by-ID read projects totals from the stored run. No metric or optimum is accepted from the client, and optima remain private. This adds no efficiency penalty, score rule, ranking change or replenishment decision.

### Issue #49 acceptance evidence — 2026-11-04

| Criterion | Status | Evidence |
| --- | --- | --- |
| Chest/run metrics updated exactly once per accepted move | PASS | `serverEngine.test.ts` checks valid/invalid totals, breaks, ignored/terminal guards and progression. PostgreSQL tests check racing actions, exact replays, continuation and rejected post-finish actions against stored JSONB. |
| Valid/invalid moves, breaks and reset have unit/integration coverage | PASS | Engine regression and PostgreSQL lifecycle tests preserve all counters through repeated resets, partial damage, three pick breaks and finalization; Game Over receives the server totals. |
| Refresh, cross-tab races, retries, reconnect and reset preserve penalties | PASS | PostgreSQL tests perform fresh reads, race different action IDs at one version, replay exact IDs, reopen a real WebSocket and replay a 20-move burst; failure injection rolls counters and replay writes back together. |
| Unverified optimum unavailable rather than guessed | PASS | Generator tests force all 12 searches to return null and require null metadata; verified candidates and best-candidate fallbacks match solver lengths. Seeded early/threshold and late indices 99/999/9999 replay legal solutions; the solver is independently checked against reference BFS. Public DTO tests exclude optimal metadata. |
| Incompatible state changes/migrations documented | PASS | `RunState` and pure function signatures remain compatible. Optional lock metadata and additive result totals require no SQL migration or legacy backfill; see [data model](data-model.md#statistics-compatibility-49). |

Verification is local; this evidence does not establish deployed browser behavior or Neon/production readiness.
