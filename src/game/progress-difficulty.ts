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
  const index = Math.max(0, chestIndex);
  // Grow beyond the final display band without rapidly increasing complexity.
  const difficulty = Math.log2(1 + index / 4);
  const tumblerCount = index < 4 ? 3 : index < 10 ? 4 : index < 18 ? 5 : 6;
  const minSolutionLength = Math.max(2, Math.floor(2 + difficulty * 3));

  return {
    tumblerCount,
    minPosition: DEFAULT_MIN_POSITION,
    maxPosition: DEFAULT_MAX_POSITION,
    targetPosition: DEFAULT_TARGET_POSITION,
    dependencyDensity: Math.min(0.88, 0.18 + difficulty * 0.18),
    guaranteedSolvableMoves: Math.max(3, Math.round(3 + difficulty * 4)),
    minSolutionLength,
    maxSolutionLength: Math.max(
      minSolutionLength,
      Math.ceil(4 + difficulty * 3),
    ),
  };
}
