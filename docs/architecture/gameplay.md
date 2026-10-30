# Gameplay engine and balance

## Current domain rules

The engine is pure TypeScript in `src/game`:

- `types.ts`: `RunState`, `LockState`, `Pin`, `MoveRule`, `DifficultyConfig`.
- `generateRules.ts`: a pin always affects itself and may affect others; for each +1 move, generate an inverse -1 move.
- `createLock.ts`: start solved, mix with legal moves, evaluate candidates with a solver; bounded retries and solvable fallback.
- `solver.ts`: bidirectional BFS with default 20,000-state search budget. `null` may mean budget exhaustion or no path; don't equate those.
- `applyMove.ts`: reject out-of-bounds without changing pin positions; increment pick damage; break on 3 invalid moves; completed lock blocks further moves.
- `resetLock.ts`: manually restores initial lock positions; **current code incorrectly clears partial damage**, see #37.
- `createRun.ts`: starts at chest 1, 0 ore, 3 picks; chest continuation grants loot and creates next lock.
- `progressDifficulty.ts`: pin counts 3→4→5→6 and increasing density/solution target; UI band thresholds are offset relative to displayed chest numbering (#48).
- `rewards.ts`: currently contains random ore and lockpick rewards; slated for redesign.

## Target lifecycle

```text
Create session -> Start run -> Generate solvable lock -> Playing
Playing --valid move--> Playing or Chest opened
Playing --invalid move--> Pick damage / break -> Playing or Run finished
Playing --reset--> Initial pin positions (damage and penalties retained)
Chest opened --continue--> Server awards once and generates next chest
Run finished --> Server finalizes score; new run requires explicit action
```

All transitions and rewards are computed on the server, never by the client.

## Scoring direction, not finalized numbers

- Ruda is based on chest index and performance rather than random ore rolls.
- Track **per-chest cumulative** accepted moves, invalid moves, broken picks and run totals. Counter values **must survive resets**.
- Evaluate extra successful moves against a **verified** shortest path; if unverified, do not silently invent an optimum or unfairly penalize.
- Server calculates the award once after the lock is solved; repeated continue cannot yield multiple grants.
- Difficulty should be measured empirically over many seeded locks; do not equate high density with universal human difficulty.
- Preserve endless as primary game; a bounded competitive variant is a proposal, not a requirement.

## Gameplay invariants to test

- All pins stay in bounds and move according to effects; invalid moves change no positions.
- Three invalid moves on the same pick break it; intervening valid moves do not heal damage.
- Reset never restores broken picks or partially damaged picks; never erases cumulative scoring penalties.
- Solved and failed states reject further gameplay mutations.
- Reward is monotonic in chest number **at base value** and nonincreasing in mistakes / wasted moves.
- Generated locks can be solved through actual legal moves; verify solver path replay.
- UI shows the same chest index/difficulty band as the generated puzzle (beware 0-based vs 1-based indexing).

Related: #28, #36–#39, #47–#51.
