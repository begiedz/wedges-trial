import { beforeEach, describe, expect, it, vi } from "vitest";

import { createChestLock } from "@/game/create-lock";
import { createRun, openSolvedChest } from "@/game/create-run";
import { RULESET_VERSION } from "@/game/ruleset";

vi.mock("@/game/create-lock", () => ({
  createChestLock: vi.fn(() => ({
    pins: [{ id: 0, min: 0, max: 6, target: 3, position: 2 }],
    rules: [],
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: 4,
    isSolved: false,
    isFailed: false,
  })),
}));

describe("run progression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses consecutive zero-based difficulty indices for displayed chests", () => {
    const random = () => 0.5;
    let run = createRun(random);

    expect(run.chestIndex).toBe(1);
    expect(run.lockpicks).toBe(1);
    expect(createChestLock).toHaveBeenLastCalledWith(0, random);

    for (let chestIndex = 2; chestIndex <= 26; chestIndex += 1) {
      run = openSolvedChest(
        { ...run, currentLock: { ...run.currentLock, isSolved: true } },
        random,
      );

      expect(run.chestIndex).toBe(chestIndex);
      expect(createChestLock).toHaveBeenLastCalledWith(
        chestIndex - 1,
        random,
        RULESET_VERSION,
      );
    }
  });

  it("applies loot before advancing to the next lock", () => {
    const initial = createRun(() => 0.5);
    const solved = {
      ...initial,
      currentLock: {
        ...initial.currentLock,
        isSolved: true,
        invalidMovesOnCurrentPick: 3,
      },
    };
    const next = openSolvedChest(solved, () => 0.5);

    expect(next.oreNuggets).toBe(initial.oreNuggets + next.reward.oreNuggets);
    expect(next.reward.oreNuggets).toBeGreaterThan(0);
    expect(next.lockpicks).toBe(initial.lockpicks + next.reward.lockpicks);
    expect(next.currentLock.isSolved).toBe(false);
    expect(next.currentLock.invalidMovesOnCurrentPick).toBe(3);
    expect(solved.chestIndex).toBe(1);
    expect(solved.oreNuggets).toBe(0);
  });

  it("does not advance or generate a new lock for an unsolved chest", () => {
    const run = createRun(() => 0.5);
    vi.clearAllMocks();

    expect(openSolvedChest(run, () => 0.5)).toEqual({
      ...run,
      reward: { oreNuggets: 0, lockpicks: 0 },
    });
    expect(createChestLock).not.toHaveBeenCalled();
  });
});
