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

The solver uses a bounded bidirectional breadth-first search, checked against reference BFS on seeded small locks. Generation stores `optimalMoves` only for a verified shortest path (including a shortened path’s suffix); construction-only fallback locks store `null`. This internal value is the shortest distance from the chest’s initial layout, stays fixed through moves/reset, and is absent on legacy locks. A null/absent value means unavailable, never a guessed optimum. `solveLockDetailed()` distinguishes found, budget-exhausted and proven-unsolvable searches; every found path is replayed before return. The compatibility path/null helper does not prove unsolvability on null. Generation exposes ephemeral diagnostics and a replayed construction witness to offline tools, while its production wrapper retains the existing lock shape. See [#50 validation and measured difficulty](lock-validation.md). Generated locks retain solvability by construction; test actual legal solution replay. Do not penalize players against an unverified shortest path.

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

## Reward transparency and balance evidence (#47) — 2026-11-05

The approved formula remains `deterministic-ore-v1`. `ORE_REWARD_TUNING` in `src/game/rewards.ts` centralizes base ore (10), chest increment (5), efficiency denominator (10) and minimum numerator (4). `getDeterministicOre()` returns the final ore amount; its code comment explains the calculation and counter lifecycle. Flooring happens on the final award: chest 2 with one mistake gives 13 ore from base 15, a deduction of 2. Each additional mistake reduces efficiency by one tenth until six mistakes reach the 40% floor; further mistakes cannot reduce ore below that floor. Very late base rewards stay linear; no new cap or valid-move penalty is introduced.

At the task author's request, the chest-opened UI retains its previous appearance: reward items and total ore only. Calculation rules are explained beside `getDeterministicOre()`, without a public breakdown field or additional UI copy. Pick rewards are rolled separately via `getLockpickReward()`; authoritative ore never invokes the legacy random-ore helper.

### Reproducible resource simulation

Run `node scripts/simulate-rewards.mjs` with Node 24. Seed: 47; 10,000 runs per profile; maximum 1,000 credited chests. The model starts with three picks, carries partial damage between chests, consumes a pick every third mistake and ends immediately when the last pick breaks, before any loot is granted. Every surviving chest is solved and continued. Each profile has a fixed mistake count per attempted chest and uses the unchanged 0/1/2 pick distribution (0.58/0.34/0.08). This measures resource sustain and ore distribution; it does not model puzzle generation, human ability, difficulty or runtime latency. Survivors at the cap are censored, not finished runs eligible for ranking.

| Mistakes/chest | Median credited chests | P95 chests | Reached cap | Median ore | P95 ore |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 1,000 | 1,000 | 100% | 2,507,500 | 2,507,500 |
| 1 | 1,000 | 1,000 | 92.9% | 2,256,500 | 2,256,500 |
| 2 | 10 | 43 | 0% | 260 | 3,956 |
| 3 | 3 | 9 | 0% | 31 | 187 |
| 6 | 1 | 2 | 0% | 4 | 10 |

| Chest number | Base ore | One mistake | Three mistakes | Six or more mistakes |
| --- | ---: | ---: | ---: | ---: |
| 1 | 10 | 9 | 7 | 4 |
| 10 | 55 | 49 | 38 | 22 |
| 100 | 505 | 454 | 353 | 202 |
| 1,000 | 5,005 | 4,504 | 3,503 | 2,002 |
| 10,000 | 50,005 | 45,004 | 35,003 | 20,002 |

The expected pick grant is 0.5/chest, balancing roughly 1.5 mistakes/chest before truncation effects. A perfect player never spends picks and has no designed end. Efficiency penalties alone cannot make endless runs finite. Random replenishment affects survival and competitive fairness; replacing it requires an explicit product decision and a new ranking cohort review. These results document the approved formula rather than establish release calibration. Excess-valid-move candidates were considered and remain deferred by the #51 decision: no penalty against either verified or unavailable optima is added. Difficulty calibration, measured player behavior and automation controls remain #48/#50/#43 work.

### Compatibility and rollback

No stored-state change, SQL migration, backfill, response contract change or new ruleset is needed. Pending rewards, metrics and historical replay JSON remain unchanged. Rollback preserves existing rewards, counters and replay records. No database rewrite, deployment or GitHub issue mutation is part of this change.

### Issue #47 acceptance evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| Same chest/mistakes always produce the same ore | PASS | `rewards.test.ts` checks exact integer awards, including rounding, early and late chests. Authoritative transitions use the pure formula; RNG supplies picks only. |
| More mistakes never increase reward; later base grows | PASS | Monotonic tests through chest 100,000 and mistake counts past the floor; reproducible simulation above. |
| Break/reset/reload/retry/multiple tabs preserve penalties | PASS | Engine regressions and PostgreSQL reward lifecycle test preserve four cumulative mistakes through a break, partial damage, repeated reset, fresh reads, exact replays and racing solve requests. |
| Server reward credited at most once | PASS | PostgreSQL tests race same-ID and distinct-ID continue requests and verify one credit, stable pending loot after injected transaction failure, and successful retry. |
| Zero mistakes, partial damage, broken picks, floor, later chests tested | PASS | `rewards.test.ts`, `serverEngine.test.ts` and `postgres.test.ts`. |
| Assumptions documented and tuning centralized | PASS | `ORE_REWARD_TUNING`, seeded simulation and sustain limitations above; approved balance and open replenishment decisions remain distinct. |
| Reward UI scope | PASS | The task author explicitly superseded the issue’s breakdown UI request: the original dialog and four dictionaries are retained; calculation is documented at `getDeterministicOre()`. |

Local verification does not establish deployed browser behavior or production readiness.
