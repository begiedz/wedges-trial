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

export type LockDifficulty = "easy" | "medium" | "hard" | "master";

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

export type DifficultyConfig = {
  pinCount: number;
  minPosition: number;
  maxPosition: number;
  targetPosition: number;
  dependencyDensity: number;
  guaranteedSolvableMoves: number;
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
