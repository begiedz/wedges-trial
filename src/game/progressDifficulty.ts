import {
  DEFAULT_MAX_POSITION,
  DEFAULT_MIN_POSITION,
  DEFAULT_TARGET_POSITION,
} from "@/game/constants";
import type { DifficultyConfig, LockDifficulty } from "@/game/types";

function getDifficultyBand(chestIndex: number): LockDifficulty {
  if (chestIndex >= 18) {
    return "master";
  }

  if (chestIndex >= 10) {
    return "hard";
  }

  if (chestIndex >= 4) {
    return "medium";
  }

  return "easy";
}

export function getDifficultyForChest(chestIndex: number): DifficultyConfig {
  const safeIndex = Math.max(0, chestIndex);
  const band = getDifficultyBand(safeIndex);

  switch (band) {
    case "easy":
      return {
        pinCount: 3,
        minPosition: DEFAULT_MIN_POSITION,
        maxPosition: DEFAULT_MAX_POSITION,
        targetPosition: DEFAULT_TARGET_POSITION,
        dependencyDensity: Math.min(0.2 + safeIndex * 0.04, 0.35),
        guaranteedSolvableMoves: Math.min(5, 3 + safeIndex),
      };
    case "medium":
      return {
        pinCount: 4,
        minPosition: DEFAULT_MIN_POSITION,
        maxPosition: DEFAULT_MAX_POSITION,
        targetPosition: DEFAULT_TARGET_POSITION,
        dependencyDensity: Math.min(0.35 + (safeIndex - 4) * 0.03, 0.55),
        guaranteedSolvableMoves: Math.min(
          8,
          5 + Math.floor((safeIndex - 4) / 2),
        ),
      };
    case "hard":
      return {
        pinCount: 5,
        minPosition: DEFAULT_MIN_POSITION,
        maxPosition: DEFAULT_MAX_POSITION,
        targetPosition: DEFAULT_TARGET_POSITION,
        dependencyDensity: Math.min(0.55 + (safeIndex - 10) * 0.025, 0.75),
        guaranteedSolvableMoves: Math.min(
          12,
          8 + Math.floor((safeIndex - 10) / 2),
        ),
      };
    case "master":
      return {
        pinCount: 6,
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
