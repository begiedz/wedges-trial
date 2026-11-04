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

export type LockDifficulty = 1 | 2 | 3 | 4;

export type LockState = {
  /** Verified shortest distance from this chest’s initial layout.
   * null/absent means unverified (including legacy locks and capped searches).
   * Remains fixed as pins move; internal metadata, never a scoring penalty.
   */
  optimalMoves?: number | null;
  pins: Pin[];
  rules: MoveRule[];
  /** Durability only; resets on break, unlike cumulative server metrics. */
  invalidMovesOnCurrentPick: number;
  maxInvalidMovesPerPick: number;
  isSolved: boolean;
  isFailed: boolean;
};

export type RunState = {
  chestIndex: number;
  oreNuggets: number;
  lockpicks: number;
  currentLock: LockState;
};

export type DifficultyConfig = {
  tumblerCount: number;
  minPosition: number;
  maxPosition: number;
  targetPosition: number;
  dependencyDensity: number;
  guaranteedSolvableMoves: number;
  // Desired shortest-path window; generation uses bounded retries to approach it.
  minSolutionLength?: number;
  maxSolutionLength?: number;
};

export type ChestReward = {
  oreNuggets: number;
  lockpicks: number;
};

export type RandomSource = () => number;

export type LockMove = {
  pinId: PinId;
  direction: Direction;
};
