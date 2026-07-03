import {
  DEFAULT_MAX_POSITION,
  DEFAULT_MIN_POSITION,
  DEFAULT_TARGET_POSITION,
} from "@/game/constants";
import type { DifficultyConfig, LockDifficulty } from "@/game/types";

export function getDifficultyBand(chestIndex: number): LockDifficulty {
  if (chestIndex >= 18) {
    return 4;
  }

  if (chestIndex >= 10) {
    return 3;
  }

  if (chestIndex >= 4) {
    return 2;
  }

  return 1;
}

export function getDifficultyForChest(chestIndex: number): DifficultyConfig {
  const safeIndex = Math.max(0, chestIndex);
  const band = getDifficultyBand(safeIndex);

  switch (band) {
    case 1:
      return {
        tumblerCount: 3,
        minPosition: DEFAULT_MIN_POSITION,
        maxPosition: DEFAULT_MAX_POSITION,
        targetPosition: DEFAULT_TARGET_POSITION,
        dependencyDensity: Math.min(0.2 + safeIndex * 0.04, 0.35),
        guaranteedSolvableMoves: Math.min(5, 3 + safeIndex),
      };
    case 2:
      return {
        tumblerCount: 4,
        minPosition: DEFAULT_MIN_POSITION,
        maxPosition: DEFAULT_MAX_POSITION,
        targetPosition: DEFAULT_TARGET_POSITION,
        dependencyDensity: Math.min(0.35 + (safeIndex - 4) * 0.03, 0.55),
        guaranteedSolvableMoves: Math.min(
          8,
          5 + Math.floor((safeIndex - 4) / 2),
        ),
      };
    case 3:
      return {
        tumblerCount: 5,
        minPosition: DEFAULT_MIN_POSITION,
        maxPosition: DEFAULT_MAX_POSITION,
        targetPosition: DEFAULT_TARGET_POSITION,
        dependencyDensity: Math.min(0.55 + (safeIndex - 10) * 0.025, 0.75),
        guaranteedSolvableMoves: Math.min(
          12,
          8 + Math.floor((safeIndex - 10) / 2),
        ),
      };
    case 4:
      return {
        tumblerCount: 6,
        minPosition: DEFAULT_MIN_POSITION,
        maxPosition: DEFAULT_MAX_POSITION,
        targetPosition: DEFAULT_TARGET_POSITION,
        dependencyDensity: Math.min(0.72 + (safeIndex - 18) * 0.015, 0.9),
        guaranteedSolvableMoves: Math.min(
          16,
          10 + Math.floor((safeIndex - 18) / 2),
        ),
      };
  }
}
