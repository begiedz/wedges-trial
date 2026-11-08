import { LEGACY_RULESET_VERSION, RULESET_VERSION } from "@/game/ruleset";
import type { ChestReward, RandomSource } from "@/game/types";

/** Tuning for deterministic-ore-v1; changes require a ranking cohort review. */
export const ORE_REWARD_TUNING = {
  firstChestBase: 10,
  baseIncreasePerChest: 5,
  efficiencyTenths: 10,
  minimumEfficiencyTenths: 4,
} as const;

/** New balance: 79% none, 17% one, 4% two; never cap stored inventory. */
export function getLockpickReward(
  random: RandomSource = Math.random,
  rulesetVersion: string = RULESET_VERSION,
): number {
  const roll = random();
  if (rulesetVersion === LEGACY_RULESET_VERSION)
    return roll > 0.92 ? 2 : roll > 0.58 ? 1 : 0;
  return roll > 0.96 ? 2 : roll > 0.79 ? 1 : 0;
}

/** Legacy random ore for debug tooling only. */
export function getChestReward(
  chestIndex: number,
  random: RandomSource = Math.random,
): ChestReward {
  const safeIndex = Math.max(0, chestIndex);
  const baseOre = 4 + safeIndex * 3;
  const oreBonus = Math.floor(
    random() * (4 + Math.min(6, Math.floor(safeIndex / 3))),
  );
  return {
    oreNuggets: baseOre + oreBonus,
    lockpicks: getLockpickReward(random),
  };
}

/**
 * deterministic-ore-v1 (approved 2026-11-01), calculated only from server-owned inputs.
 * chestNumber is 1-based: base ore starts at 10 and grows by 5 per chest.
 * Every invalid move on this chest removes 10 percentage points of the base
 * reward, down to 40% after six mistakes. Count all mistakes, including partial
 * pick damage and those before a reset or pick break; clear only on a new chest.
 * Floor the final award using integer tenths to avoid floating-point floor errors.
 * Valid moves incur no penalty, regardless of the shortest solution length.
 * Solving stores the pending reward; the server credits it once on continue.
 */
export function getDeterministicOre(
  chestNumber: number,
  invalidMoves: number,
): number {
  const tuning = ORE_REWARD_TUNING;
  const baseOre =
    tuning.firstChestBase + tuning.baseIncreasePerChest * (chestNumber - 1);
  return Math.floor(
    (baseOre *
      Math.max(
        tuning.minimumEfficiencyTenths,
        tuning.efficiencyTenths - invalidMoves,
      )) /
      tuning.efficiencyTenths,
  );
}
