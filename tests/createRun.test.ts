import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLock } from "@/game/createLock";
import { createRun, openSolvedChest } from "@/game/createRun";
import { getDifficultyForChest } from "@/game/progressDifficulty";

vi.mock("@/game/createLock", () => ({
  createLock: vi.fn(() => ({
    pins: [{ id: 0, min: 0, max: 6, target: 3, position: 2 }],
    rules: [],
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: 3,
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
    expect(createLock).toHaveBeenLastCalledWith(
      getDifficultyForChest(0),
      random,
    );

    for (let chestIndex = 2; chestIndex <= 20; chestIndex += 1) {
      run = openSolvedChest(
        { ...run, currentLock: { ...run.currentLock, isSolved: true } },
        random,
      );

      expect(run.chestIndex).toBe(chestIndex);
      expect(createLock).toHaveBeenLastCalledWith(
        getDifficultyForChest(chestIndex - 1),
        random,
      );
    }
  });

  it("applies loot before advancing to the next lock", () => {
    const initial = createRun(() => 0.5);
    const solved = {
      ...initial,
      currentLock: { ...initial.currentLock, isSolved: true },
    };
    const next = openSolvedChest(solved, () => 0.5);

    expect(next.oreNuggets).toBe(initial.oreNuggets + next.reward.oreNuggets);
    expect(next.reward.oreNuggets).toBeGreaterThan(0);
    expect(next.lockpicks).toBe(initial.lockpicks + next.reward.lockpicks);
    expect(next.currentLock.isSolved).toBe(false);
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
    expect(createLock).not.toHaveBeenCalled();
  });
});
