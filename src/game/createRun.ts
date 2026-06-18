import { createLock } from "@/game/createLock";
import { getDifficultyForChest } from "@/game/progressDifficulty";
import { getChestReward } from "@/game/rewards";
import type { ChestReward, RandomSource, RunState } from "@/game/types";

export function createRun(random: RandomSource = Math.random): RunState {
  return {
    chestIndex: 0,
    oreNuggets: 0,
    lockpicks: 3,
    currentLock: createLock(getDifficultyForChest(0), random),
  };
}

export function openSolvedChest(
  run: RunState,
  random: RandomSource = Math.random,
): RunState & { reward: ChestReward } {
  if (!run.currentLock.isSolved) {
    return {
      ...run,
      reward: {
        oreNuggets: 0,
        lockpicks: 0,
      },
    };
  }

  const reward = getChestReward(run.chestIndex, random);
  const nextChestIndex = run.chestIndex + 1;

  return {
    chestIndex: nextChestIndex,
    oreNuggets: run.oreNuggets + reward.oreNuggets,
    lockpicks: run.lockpicks + reward.lockpicks,
    currentLock: createLock(getDifficultyForChest(nextChestIndex), random),
    reward,
  };
}
