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

The solver uses a bounded search. A null result can mean budget exhaustion and does not prove unsolvability or an optimum. Generated locks retain solvability by construction; test actual legal solution replay. Do not penalize players against an unverified shortest path.

Measure early, threshold and high-chest generation, fallbacks and difficulty before setting new tiers or efficiency penalties. Endless remains primary; competitive mode/order remains open. See [decisions](decisions.md), #28 and #47–#51.
