---
name: game-engine
description: Use for puzzle generation, pin movement rules, solver, lock reset, difficulty and scoring changes in src/game. Preserve lock invariants and measure balancing changes.
---

# Game engine skill

Read `AGENTS.md`, `docs/architecture/gameplay.md`, `docs/architecture/decisions.md` and relevant tests before changing logic.

## Procedure

1. Inspect `src/game/types.ts`, `applyMove.ts`, `generateRules.ts`, `createLock.ts`, `solver.ts`, `resetLock.ts`, `progressDifficulty.ts`, `rewards.ts` and impacted tests.
2. Make **pure functions** with explicit inputs and deterministic test randomness where useful. No DB, HTTP, React, audio or hidden global state inside game-engine modules.
3. Preserve three-invalid-moves break rule, bounds checking, inverse rules, solved-state guards and manual reset. Fix reset free-durability exploit with a test.
4. Confirm the generator can produce legal solved paths; distinguish a verified optimal path from a capped solver returning `null`.
5. For reward changes, use **server-owned** counters and deterministic ore; numeric curves and extra-move penalties are proposals until approved.
6. Run seeded simulations over early, threshold and very late chests to measure actual difficulty distribution, worst-case solver cost and fallbacks.

## Done when

- Tests prove rules, reset, run progression, and generator consistency; no hidden mutation.
- A change in balance is documented in `decisions.md` and in corresponding GitHub issue.
- Any score-affecting change is designed to be versioned for comparisons with historic runs.
