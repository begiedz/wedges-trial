import type { ChestReward, RandomSource } from "@/game/types";

export function getChestReward(
  chestIndex: number,
  random: RandomSource = Math.random,
): ChestReward {
  const safeIndex = Math.max(0, chestIndex);
  const baseOre = 4 + safeIndex * 3;
  const oreBonus = Math.floor(
    random() * (4 + Math.min(6, Math.floor(safeIndex / 3))),
  );
  const pickRoll = random();

  let lockpicks = 0;

  if (pickRoll > 0.92) {
    lockpicks = 2;
  } else if (pickRoll > 0.58) {
    lockpicks = 1;
  }

  return {
    oreNuggets: baseOre + oreBonus,
    lockpicks,
  };
}
