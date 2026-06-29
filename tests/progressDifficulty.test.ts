import { describe, expect, it } from "vitest";

import { getDifficultyForChest } from "@/game/progressDifficulty";

describe("getDifficultyForChest", () => {
  it("never makes later chests easier", () => {
    const early = getDifficultyForChest(0);
    const middle = getDifficultyForChest(8);
    const late = getDifficultyForChest(20);

    expect(middle.tumblerCount).toBeGreaterThanOrEqual(early.tumblerCount);
    expect(late.tumblerCount).toBeGreaterThanOrEqual(middle.tumblerCount);
    expect(middle.dependencyDensity).toBeGreaterThanOrEqual(
      early.dependencyDensity,
    );
    expect(late.dependencyDensity).toBeGreaterThanOrEqual(
      middle.dependencyDensity,
    );
  });

  it("keeps tumbler counts within the allowed range", () => {
    for (const chestIndex of [0, 4, 10, 18, 30]) {
      const config = getDifficultyForChest(chestIndex);
      expect(config.tumblerCount).toBeGreaterThanOrEqual(3);
      expect(config.tumblerCount).toBeLessThanOrEqual(6);
    }
  });

  it("increases guaranteed solution length over time", () => {
    expect(getDifficultyForChest(0).guaranteedSolvableMoves).toBeLessThan(
      getDifficultyForChest(12).guaranteedSolvableMoves,
    );
    expect(
      getDifficultyForChest(12).guaranteedSolvableMoves,
    ).toBeLessThanOrEqual(getDifficultyForChest(24).guaranteedSolvableMoves);
  });

  it("keeps dependency density in a safe range", () => {
    for (const chestIndex of [0, 8, 16, 24, 40]) {
      const density = getDifficultyForChest(chestIndex).dependencyDensity;
      expect(density).toBeGreaterThan(0);
      expect(density).toBeLessThanOrEqual(0.9);
    }
  });
});
