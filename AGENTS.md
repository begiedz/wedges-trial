<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# AI Agent Package — Wedge’s Trial

## 1. Project Identity

Build **Wedge’s Trial**, a browser-based endless lockpicking challenge game inspired by Gothic-style game lore and Gothic Remake lockpicking mechanics.

The project is an MVP focused on a deterministic puzzle engine, endless run progression, local persistence, and a clean browser UI.

The game must be implemented as a modern **Next.js + React + TypeScript** application.

---

## 2. Core Product Goal

Create an endless lockpicking game where the player opens an infinite sequence of randomly generated chests.

Each chest contains:

- ore nuggets
- lockpicks

The player uses lockpicks to solve locks. Every successfully opened chest advances the run and makes the next lock slightly harder.

The primary objective is to collect as many **ore nuggets** as possible before running out of lockpicks.

Ore nuggets are the score resource for the leaderboard logic. For MVP, leaderboard data is local-only.

---

## 3. Non-Negotiable Product Rules

These rules must not be changed.

1. The primary game mode is **endless**.
2. A random lock is generated for every chest.
3. Every next chest must be slightly harder than the previous one.
4. Difficulty progression is mainly based on:
   - number of pins / tumblers
   - number of dependencies between pins
   - generated solution length

5. The only MVP player resources are:
   - lockpicks
   - ore nuggets

6. Opening a chest gives ore nuggets, not abstract points.
7. A lockpick breaks after exactly **3 invalid moves**.
8. An invalid move is a move that would push at least one affected pin outside its allowed range.
9. Invalid moves do not change pin positions.
10. The lock does not reset automatically after a lockpick breaks.
11. The current lock may be reset only by a dedicated manual reset button.
12. State is saved after each opened chest.
13. Save state is local-only for MVP.
14. No backend for MVP.

---

## 4. Required Technical Stack

Use:

- Next.js
- React
- TypeScript
- RadixUI
- BiomeJS
- Vitest

Use provided UI elements from the components folder. If there is not component ready - use a placeholder.

Do not introduce a backend for MVP.

Use local browser persistence only, preferably `localStorage`.

---

## 5. Localization Requirements

The game must support:

- English: `en`
- Polish: `pl`
- German: `de`
- Russian: `ru`

English is the default fallback language.

Rules:

- Do not hardcode user-facing strings in React components.
- Use translation keys and dictionaries.
- Use default Next.js locale support.
- All visible labels, buttons, messages, resource names, and tutorial text must use translations.

---

## 6. Core Gameplay Model

The player sees a lock with several pins / sliders.

Each pin has:

- current position
- target position
- minimum allowed position
- maximum allowed position

Example:

- min: `0`
- max: `6`
- target: `3`

The goal is to move all pins to their target position.

The player selects a pin and moves it left or right.

Moving one pin may also affect other pins.

Example:

```ts
pin 0 right:
  pin 0 +1
  pin 2 -1

pin 1 left:
  pin 1 -1
  pin 3 -1
```

This is a logical dependency puzzle, not a reflex-based minigame.

---

## 7. Domain Types

Create a pure domain layer independent from React rendering.

Use these base types:

```ts
export type Direction = -1 | 1;

export type PinId = number;

export type Pin = {
  id: PinId;
  position: number;
  target: number;
  min: number;
  max: number;
};

export type PinEffect = {
  pinId: PinId;
  delta: Direction;
};

export type MoveRule = {
  sourcePinId: PinId;
  direction: Direction;
  effects: PinEffect[];
};

export type LockDifficulty = 'easy' | 'medium' | 'hard' | 'master';

export type LockState = {
  pins: Pin[];
  rules: MoveRule[];
  invalidMovesOnCurrentPick: number;
  maxInvalidMovesPerPick: 3;
  isSolved: boolean;
  isFailed: boolean;
};

export type RunState = {
  chestIndex: number;
  oreNuggets: number;
  lockpicks: number;
  currentLock: LockState;
};
```

Important rule:

`invalidMovesOnCurrentPick` reaches `3` exactly when one lockpick breaks.

The current lock must remain in its current position after a lockpick breaks.

---

## 8. Move Rules

Implement `applyMove` as a pure function.

Requirements:

- Do not mutate input state.
- If the lock is solved, return unchanged state.
- If the lock has failed because the player has no lockpicks left, return unchanged state.
- Find the move rule matching selected pin and direction.
- Calculate affected pin positions.
- If at least one affected pin would exceed min/max range:
  - do not change pin positions
  - increment invalid move counter
  - if invalid counter reaches 3, break one lockpick at the run level

- If move is valid:
  - update pin positions
  - check if solved

Suggested split:

```ts
applyMoveToLock(...)
applyInvalidMoveToRun(...)
applyValidMoveToRun(...)
```

Do not mix UI effects with engine logic.

---

## 9. Lock Generation

The generator must guarantee solvability.

Use this method:

1. Start from a solved lock.
2. Generate symmetric move rules.
3. Apply a sequence of valid random reverse/mixing moves.
4. The resulting state becomes the player’s starting lock.
5. The solution exists because it is the inverse of the generated mixing path.

Do not generate a fully random pin layout and then hope it is solvable.

The generated lock must not start already solved.

If generation produces an already solved state, regenerate or apply additional valid mixing moves.

---

## 10. Dependency Rule Generation

Each pin must always affect itself.

A move may optionally affect other pins.

For every generated right move, generate a symmetric left move.

Example:

```ts
{
  sourcePinId: 0,
  direction: 1,
  effects: [
    { pinId: 0, delta: 1 },
    { pinId: 2, delta: -1 },
    { pinId: 3, delta: 1 }
  ]
}
```

Inverse:

```ts
{
  sourcePinId: 0,
  direction: -1,
  effects: [
    { pinId: 0, delta: -1 },
    { pinId: 2, delta: 1 },
    { pinId: 3, delta: -1 }
  ]
}
```

This keeps the rule system easier to balance and test.

---

## 11. Endless Difficulty Progression

Difficulty must increase with chest index.

Primary scaling variables:

- pin count
- dependency density
- generated solution length
- amount of resource pressure through lockpick rewards

Create a progression function:

```ts
export type DifficultyConfig = {
  pinCount: number;
  minPosition: number;
  maxPosition: number;
  targetPosition: number;
  dependencyDensity: number;
  guaranteedSolvableMoves: number;
};

export function getDifficultyForChest(chestIndex: number): DifficultyConfig;
```

Expected behavior:

- early chests: fewer pins, fewer dependencies, shorter solution paths
- later chests: more pins, more dependencies, longer solution paths
- progression should be gradual, not abrupt

MVP difficulty bands:

```ts
easy:
  pinCount: 3
  dependencyDensity: low
  solutionLength: 3–5

medium:
  pinCount: 4
  dependencyDensity: medium
  solutionLength: 5–8

hard:
  pinCount: 5
  dependencyDensity: high
  solutionLength: 8–12

master:
  pinCount: 6
  dependencyDensity: high
  solutionLength: 10–16
```

---

## 12. Chest Rewards

Each opened chest grants ore nuggets and may grant lockpicks.

MVP reward rules should be deterministic enough to test but variable enough to feel like loot.

Suggested model:

```ts
export type ChestReward = {
  oreNuggets: number;
  lockpicks: number;
};
```

Rules:

- ore nuggets increase with chest index
- lockpick rewards are limited
- endless mode should eventually pressure the player
- avoid guaranteed infinite sustain

Example:

```ts
oreNuggets = randomRange(baseOre, baseOre + scalingBonus)
lockpicks = weightedRandom(0, 1, rarely 2)
```

---

## 13. Save System

State must be saved after each opened chest.

MVP persistence:

- local-only
- no backend
- use `localStorage`
- save run state
- allow continue run
- allow start new run

Save after:

- successfully opened chest
- reward applied
- next lock generated

Do not save after every pin movement unless explicitly needed.

---

## 14. UI Requirements

Main screen must show:

- game title
- current chest number
- current ore nuggets
- current lockpick count
- current lock
- pin visualization
- selected pin
- left/right controls
- lockpick durability state for the currently used lockpick
- manual reset button
- success state
- failure state
- continue/new run controls

Required actions:

- select pin
- move selected pin left
- move selected pin right
- manually reset current lock
- continue after chest opened
- start new run

---

## 15. Controls

Desktop:

- click pin to select it
- `A` or `ArrowLeft` moves selected pin left
- `D` or `ArrowRight` moves selected pin right
- visible left/right buttons must also work

Mobile MVP:

- tap pin to select it
- use visible left/right buttons

Do not implement swipe in MVP unless the core is already stable.

---

## 16. UI States

Use explicit UI/game phases.

```ts
export type GamePhase =
  | 'idle'
  | 'playing'
  | 'moving'
  | 'invalid_move'
  | 'pick_broken'
  | 'chest_opened'
  | 'run_failed';
```

Expected behavior:

- `moving`: temporarily block duplicate inputs
- `invalid_move`: trigger invalid feedback
- `pick_broken`: show broken lockpick feedback
- `chest_opened`: show reward feedback
- `run_failed`: block lock interaction and show final result

---

## 17. Visual Direction

MVP should use React + CSS/SVG, not Canvas.

Preferred aesthetic:

- dark graphite
- steel
- brass
- subtle green for correctly positioned pins
- red only for errors
- Gothic-inspired metal/chest/lock atmosphere

Required feedback:

- pin movement animation
- changed pins highlight
- invalid move shake
- solved lock success feedback
- pick break feedback

Audio is optional and should not block MVP.

---

## 18. Suggested Project Structure

Use this structure or a close equivalent:

```txt
src/
  app/
    [locale]/
      page.tsx
      layout.tsx

  game/
    types.ts
    constants.ts
    applyMove.ts
    checkSolved.ts
    generateRules.ts
    createLock.ts
    createRun.ts
    progressDifficulty.ts
    rewards.ts
    persistence.ts
    solver.ts

  components/
    LockGame.tsx
    LockPin.tsx
    LockControls.tsx
    DurabilityBar.tsx
    ResourcePanel.tsx
    ChestRewardDialog.tsx
    RunFailedDialog.tsx

  hooks/
    useLockGame.ts
    useKeyboardControls.ts

  i18n/
    dictionaries/
      en.ts
      pl.ts
      de.ts
      ru.ts
    getDictionary.ts

  tests/
    applyMove.test.ts
    generateRules.test.ts
    createLock.test.ts
    progressDifficulty.test.ts
    persistence.test.ts
```

---

## 19. Required Tests

Prioritize engine tests over UI tests.

### `applyMove`

Test that:

- valid moves update the correct pins
- invalid moves do not update pin positions
- invalid moves increment current pick damage
- a lockpick breaks after exactly 3 invalid moves
- solved state is detected
- moves are ignored after solved state
- moves are ignored after run failure

### `generateRules`

Test that:

- every pin has left and right rules
- every rule affects the source pin
- every right rule has a correct left inverse
- dependency density affects number of secondary effects

### `createLock`

Test that:

- generated lock has expected pin count
- all pins have valid min/max/target
- starting state is not already solved
- generated lock is solvable by construction

### `progressDifficulty`

Test that:

- later chests are not easier than earlier chests
- pin count increases within allowed limits
- solution length increases over time
- dependency density increases within safe limits

### `persistence`

Test that:

- run state can be saved
- run state can be restored
- invalid saved data is safely rejected
- missing saved data starts a new run

---

## 20. AI Agent Work Breakdown

Use multiple agents with strict responsibilities.

### Agent 1 — Domain Engine Agent

Responsibility:

Build pure TypeScript game logic.

Tasks:

- define domain types
- implement `applyMove`
- implement `checkSolved`
- implement rule generation
- implement lock generation
- implement difficulty progression
- implement reward generation
- implement persistence helpers
- write Vitest tests

Restrictions:

- no React
- no UI code
- no styling
- no localization strings

Output:

- tested game engine modules

---

### Agent 2 — UI Agent

Responsibility:

Build the React interface.

Tasks:

- implement `LockGame`
- implement `LockPin`
- implement `LockControls`
- implement `DurabilityBar`
- implement resource panel
- implement chest reward dialog
- implement run failed dialog
- connect UI to engine through hooks

Restrictions:

- do not modify core engine logic unless tests require it
- do not hardcode user-facing strings
- use translation keys only

Output:

- playable browser UI

---

### Agent 3 — Localization Agent

Responsibility:

Implement i18n support.

Tasks:

- create dictionaries for `en`, `pl`, `de`, `ru`
- create translation keys
- ensure English fallback
- replace all hardcoded UI strings
- validate missing translation keys

Restrictions:

- do not change game logic
- do not change visual layout unless needed for text overflow

Output:

- localized UI dictionaries and translation utility

---

### Agent 4 — QA/Test Agent

Responsibility:

Validate correctness and edge cases.

Tasks:

- review engine tests
- add missing Vitest cases
- test invalid move behavior
- test lockpick break behavior
- test manual reset behavior
- test local save/restore behavior
- test generated lock solvability
- test keyboard controls

Restrictions:

- do not rewrite architecture unnecessarily
- prefer small targeted fixes

Output:

- reliable test suite and bug fixes

---

### Agent 5 — Polish/Game Feel Agent

Responsibility:

Improve MVP feel without changing rules.

Tasks:

- add CSS/SVG lock atmosphere
- add pin movement transitions
- add invalid move shake
- add success feedback
- add lockpick break feedback
- improve responsive layout
- ensure mobile button controls work

Restrictions:

- no Canvas for MVP
- no backend
- no gameplay rule changes

Output:

- more polished MVP presentation

---

## 21. Master Prompt for AI Coding Agent

Use this prompt when assigning the project to a coding agent:

```txt
You are building Wedge’s Trial, a browser-based endless lockpicking challenge game.

Use Next.js, React, TypeScript, RadixUI, BiomeJS, and Vitest.

The game is an endless sequence of randomly generated chests. Each chest has a generated lock. Opening a chest gives ore nuggets and possibly lockpicks. Ore nuggets are the score. The run ends when the player has no lockpicks left.

Non-negotiable rules:
- Primary mode is endless.
- Every chest gets a random generated lock.
- Every next chest is slightly harder.
- Difficulty scales mainly through pin count, dependency count, and generated solution length.
- MVP resources are only lockpicks and ore nuggets.
- A lockpick breaks after exactly 3 invalid moves.
- Invalid move means at least one affected pin would leave its allowed range.
- Invalid moves do not change pin positions.
- The lock does not reset automatically when a lockpick breaks.
- The current lock can only be reset by a manual reset button.
- Save state after each opened chest.
- Save is local-only.
- No backend.

Implement the game as a tested deterministic puzzle engine first, then connect it to React UI.

Keep domain logic independent from rendering.

Use localization dictionaries for English, Polish, German, and Russian. English is fallback. Do not hardcode user-facing strings in React components.

Prioritize:
1. domain types
2. applyMove
3. rule generation
4. lock generation from solved state using valid reverse/mixing moves
5. endless run state
6. reward generation
7. local persistence
8. playable UI
9. tests
10. visual polish
```

---

## 22. Acceptance Criteria

The MVP is complete when:

- the player can start an endless run
- the player sees current chest number, ore nuggets, and lockpicks
- each chest generates a new random solvable lock
- the player can select pins and move them left/right
- valid moves update all affected pins
- invalid moves do not update pin positions
- a lockpick breaks after exactly 3 invalid moves
- broken lockpick does not reset the lock
- manual reset button resets the current lock
- solving the lock opens the chest
- opening the chest grants ore nuggets
- opening the chest may grant lockpicks
- next chest is harder than the previous one
- state is saved locally after each opened chest
- the player can continue a saved run
- the run fails when no lockpicks remain
- UI supports English, Polish, German, and Russian
- core logic has Vitest coverage
- BiomeJS passes without formatting/lint errors

---

## 23. Implementation Priority

Build in this order:

1. Pure game engine
2. Engine tests
3. Lock generator
4. Endless run state
5. Local persistence
6. Basic UI
7. Localization
8. Keyboard controls
9. Visual feedback
10. Balancing and polish

Do not start with animations or audio. The largest project risk is not UI. The largest risk is generating locks that are solvable, readable, and progressively harder without becoming frustrating.

The correct implementation order is:

```txt
logic → tests → simple UI → generator → persistence → localization → feedback → balancing → polish
```
