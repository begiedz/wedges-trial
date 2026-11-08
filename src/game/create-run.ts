import { STARTING_LOCKPICKS } from "@/game/constants";
import { createChestLock } from "@/game/create-lock";
import { getChestReward } from "@/game/rewards";
import { RULESET_VERSION } from "@/game/ruleset";
import type { ChestReward, RandomSource, RunState } from "@/game/types";

export function createRun(random: RandomSource = Math.random): RunState {
  return {
    chestIndex: 1,
    oreNuggets: 0,
    lockpicks: STARTING_LOCKPICKS,
    currentLock: createChestLock(0, random),
  };
}

export function openSolvedChest(
  run: RunState,
  random: RandomSource = Math.random,
  rulesetVersion: string = RULESET_VERSION,
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

  const currentLock = createChestLock(
    nextChestIndex - 1,
    random,
    rulesetVersion,
  );
  currentLock.invalidMovesOnCurrentPick =
    run.currentLock.invalidMovesOnCurrentPick;

  return {
    chestIndex: nextChestIndex,
    oreNuggets: run.oreNuggets + reward.oreNuggets,
    lockpicks: run.lockpicks + reward.lockpicks,
    currentLock,
    reward,
  };
}
