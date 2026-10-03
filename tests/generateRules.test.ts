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
    tumblerCount: 4,
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

    expect(rules).toHaveLength(baseConfig.tumblerCount * 2);

    for (let pinId = 0; pinId < baseConfig.tumblerCount; pinId += 1) {
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

    for (let pinId = 0; pinId < baseConfig.tumblerCount; pinId += 1) {
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

  it("uses fractional density rather than rounding every rule identically", () => {
    const moreEffects = generateRules(baseConfig, () => 0.49);
    const fewerEffects = generateRules(baseConfig, () => 0.5);

    for (let pinId = 0; pinId < baseConfig.tumblerCount; pinId += 1) {
      expect(findRule(moreEffects, pinId, 1).effects).toHaveLength(3);
      expect(findRule(fewerEffects, pinId, 1).effects).toHaveLength(2);
    }
  });

  it("samples secondary counts separately for each source pin", () => {
    const rules = generateRules(
      baseConfig,
      createSequenceRandom([0.1, 0.8, 0.8, 0.8, 0.8, 0.8]),
    );

    expect(findRule(rules, 0, 1).effects).toHaveLength(3);
    expect(findRule(rules, 1, 1).effects).toHaveLength(2);
  });

  it("respects empty and complete dependency densities", () => {
    for (const density of [0, 1]) {
      const rules = generateRules(
        { ...baseConfig, dependencyDensity: density },
        createSequenceRandom([0.1, 0.8, 0.3]),
      );

      for (const rule of rules) {
        expect(rule.effects).toHaveLength(
          density === 0 ? 1 : baseConfig.tumblerCount,
        );
        expect(new Set(rule.effects.map((effect) => effect.pinId)).size).toBe(
          rule.effects.length,
        );
      }
    }
  });
});
