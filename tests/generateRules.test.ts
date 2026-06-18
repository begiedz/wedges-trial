import { describe, expect, it } from "vitest";

import { generateRules } from "@/game/generateRules";
import type { DifficultyConfig, MoveRule, RandomSource } from "@/game/types";

function createSequenceRandom(values: number[]): RandomSource {
  let index = 0;

  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function findRule(
  rules: MoveRule[],
  pinId: number,
  direction: -1 | 1,
): MoveRule {
  const rule = rules.find(
    (candidate) =>
      candidate.sourcePinId === pinId && candidate.direction === direction,
  );

  if (!rule) {
    throw new Error("Missing rule");
  }

  return rule;
}

describe("generateRules", () => {
  const baseConfig: DifficultyConfig = {
    pinCount: 4,
    minPosition: 0,
    maxPosition: 6,
    targetPosition: 3,
    dependencyDensity: 0.5,
    guaranteedSolvableMoves: 6,
  };

  it("creates left and right rules for every pin", () => {
    const rules = generateRules(
      baseConfig,
      createSequenceRandom([0.1, 0.8, 0.3]),
    );

    expect(rules).toHaveLength(baseConfig.pinCount * 2);

    for (let pinId = 0; pinId < baseConfig.pinCount; pinId += 1) {
      expect(findRule(rules, pinId, 1)).toBeDefined();
      expect(findRule(rules, pinId, -1)).toBeDefined();
    }
  });

  it("always includes the source pin in each rule", () => {
    const rules = generateRules(
      baseConfig,
      createSequenceRandom([0.2, 0.7, 0.4]),
    );

    for (const rule of rules) {
      expect(
        rule.effects.some((effect) => effect.pinId === rule.sourcePinId),
      ).toBe(true);
    }
  });

  it("creates a correct inverse left rule for each right rule", () => {
    const rules = generateRules(
      baseConfig,
      createSequenceRandom([0.2, 0.7, 0.4]),
    );

    for (let pinId = 0; pinId < baseConfig.pinCount; pinId += 1) {
      const rightRule = findRule(rules, pinId, 1);
      const leftRule = findRule(rules, pinId, -1);

      expect(leftRule.effects).toEqual(
        rightRule.effects.map((effect) => ({
          pinId: effect.pinId,
          delta: effect.delta === 1 ? -1 : 1,
        })),
      );
    }
  });

  it("increases secondary effects as dependency density rises", () => {
    const lowDensityRules = generateRules(
      { ...baseConfig, dependencyDensity: 0.1 },
      createSequenceRandom([0.2, 0.7, 0.4]),
    );
    const highDensityRules = generateRules(
      { ...baseConfig, dependencyDensity: 0.9 },
      createSequenceRandom([0.2, 0.7, 0.4]),
    );

    const countSecondaryEffects = (rules: MoveRule[]) =>
      rules
        .filter((rule) => rule.direction === 1)
        .reduce((total, rule) => total + (rule.effects.length - 1), 0);

    expect(countSecondaryEffects(highDensityRules)).toBeGreaterThan(
      countSecondaryEffects(lowDensityRules),
    );
  });
});
