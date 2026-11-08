import { describe, expect, it, vi } from "vitest";
import { analyzeConnections } from "@/game/analyze-connections";
import { applyMoveToLock } from "@/game/apply-move";
import { checkSolved } from "@/game/check-solved";
import {
  createChestLock,
  createLock,
  createLockWithDiagnostics,
} from "@/game/create-lock";
import { generateRules } from "@/game/generate-rules";
import { getLearningProgression } from "@/game/learning-progression";
import { getDifficultyForChest } from "@/game/progress-difficulty";
import {
  LEARNING_RULESET_VERSION,
  LEGACY_RULESET_VERSION,
  RULESET_VERSION,
  SCARCE_PICKS_RULESET_VERSION,
} from "@/game/ruleset";
import { solveLockDetailed } from "@/game/solver";

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
describe("learning progression", () => {
  it("enforces the same nondecreasing structural floor across seeds through endless play", () => {
    let previous = { coreSize: 0, dependencies: 0, tier: 1 };
    let previousMin = 0;
    let previousMax = 0;
    for (let chest = 1; chest <= 151; chest++) {
      let first: ReturnType<typeof analyzeConnections> | undefined;
      const policy = getLearningProgression(chest - 1, () => 0);
      for (let seed = 0; seed < 30; seed++) {
        const rng = random(seed * 100003 + chest);
        const config = getLearningProgression(chest - 1, rng);
        const generated = generateRules(config, rng);
        const metrics = analyzeConnections(generated);
        first ??= metrics;
        expect(metrics.coreSize).toBe(config.topology?.coreSize);
        expect(metrics.dependencies).toBe(config.topology?.dependencies);
        expect(metrics.tier).toBe(first.tier);
        expect(metrics.maxFanout).toBeLessThanOrEqual(
          config.topology?.maxFanout ?? 0,
        );
        expect(config.plateCount).toBeGreaterThanOrEqual(
          Math.max(4, metrics.coreSize),
        );
        expect(config.plateCount).toBeLessThanOrEqual(7);
        if (chest <= 3)
          expect(
            generated
              .filter((rule) => rule.direction === 1)
              .every((rule) =>
                rule.effects.every((effect) => effect.delta === 1),
              ),
          ).toBe(true);
        for (const rule of generated.filter((rule) => rule.direction === 1)) {
          expect(
            generated.find(
              (other) =>
                other.sourcePinId === rule.sourcePinId &&
                other.direction === -1,
            )?.effects,
          ).toEqual(
            rule.effects.map((effect) => ({
              pinId: effect.pinId,
              delta: -effect.delta,
            })),
          );
        }
      }
      if (!first) throw new Error("No samples");
      expect(first.coreSize).toBeGreaterThanOrEqual(previous.coreSize);
      expect(first.dependencies).toBeGreaterThanOrEqual(previous.dependencies);
      expect(first.dependencies - previous.dependencies).toBeLessThanOrEqual(1);
      expect(first.tier).toBeGreaterThanOrEqual(previous.tier);
      const [windowMin, windowMax] = policy.solutionLengthRange ?? [0, 0];
      expect(windowMin).toBeGreaterThanOrEqual(previousMin);
      expect(windowMax).toBeGreaterThanOrEqual(previousMax);
      if (chest > 1 && first.dependencies > previous.dependencies) {
        expect(windowMin).toBe(previousMin);
        expect(windowMax).toBe(previousMax);
      }
      if (chest === 18)
        expect(first).toMatchObject({ coreSize: 4, dependencies: 6, tier: 3 });
      previous = first;
      previousMin = windowMin;
      previousMax = windowMax;
    }
  });
  it.each([0, 2, 4, 5, 7, 11, 12, 17, 23, 24, 29, 49, 99, 999, 9999])(
    "constructs legal solvable locks at index %i with honest optimal metadata",
    (index) => {
      for (const seed of [1, 7, 42]) {
        const rng = random(seed);
        const config = getLearningProgression(index, rng);
        const result = createLockWithDiagnostics(config, rng);
        const search = solveLockDetailed(result.lock);
        if (search.kind === "found" && result.lock.optimalMoves != null)
          expect(result.lock.optimalMoves).toBe(search.solution.length);
        let lock = result.lock;
        for (const move of result.solution) {
          const next = applyMoveToLock(lock, move.pinId, move.direction);
          expect(next.kind).toBe("valid");
          lock = next.lock;
        }
        expect(checkSolved(lock)).toBe(true);
        expect(result.solution.length).toBeLessThanOrEqual(
          config.maxSolutionLength ?? 0,
        );
        const coupled = new Set(
          result.lock.rules.flatMap((rule) =>
            rule.effects.length > 1
              ? rule.effects.map((effect) => effect.pinId)
              : [],
          ),
        );
        for (const pin of result.lock.pins)
          if (pin.id >= 4 && !coupled.has(pin.id))
            expect(pin.position).toBe(pin.target);
      }
    },
  );
  it("retains legacy generation byte-for-byte for both existing cohorts", () => {
    for (const version of [
      LEGACY_RULESET_VERSION,
      SCARCE_PICKS_RULESET_VERSION,
    ])
      for (const index of [0, 5, 12, 24, 99]) {
        expect(createChestLock(index, random(42), version)).toEqual(
          createLock(getDifficultyForChest(index), random(42)),
        );
      }
  });
  it("caps mature settings and handles negative indices as chest one", () => {
    expect(getLearningProgression(-5, () => 0)).toEqual(
      getLearningProgression(0, () => 0),
    );
    expect(getLearningProgression(9999, () => 0.5)).toEqual(
      getLearningProgression(100, () => 0.5),
    );
  });
  it("retains a legal witness and unknown optimum when searches are capped", async () => {
    const solver = await import("@/game/solver");
    const spy = vi
      .spyOn(solver, "solveLockDetailed")
      .mockReturnValue({ kind: "budget-exhausted", visitedStates: 20000 });
    try {
      const rng = random(42);
      const result = createLockWithDiagnostics(
        getLearningProgression(9999, rng),
        rng,
      );
      expect(result.diagnostics.outcome).toBe("unverified");
      expect(result.lock.optimalMoves).toBeNull();
      expect(result.diagnostics.attempts).toBe(12);
      let lock = result.lock;
      for (const move of result.solution)
        lock = applyMoveToLock(lock, move.pinId, move.direction).lock;
      expect(checkSolved(lock)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

it("keeps the saved learning handler when the new-run default is rolled back", async () => {
  vi.resetModules();
  vi.doMock("@/game/ruleset", async () => {
    const actual =
      await vi.importActual<typeof import("@/game/ruleset")>("@/game/ruleset");
    return { ...actual, RULESET_VERSION: actual.SCARCE_PICKS_RULESET_VERSION };
  });
  try {
    const { createChestLock: dispatch } = await import("@/game/create-lock");
    const learning = dispatch(17, random(42), "learning-ramp-v1");
    expect(analyzeConnections(learning.rules)).toMatchObject({
      coreSize: 4,
      dependencies: 6,
      tier: 3,
    });
    expect(dispatch(17, random(42), "difficulty-ore-v1")).toEqual(learning);
    expect(dispatch(17, random(42))).toEqual(
      createLock(getDifficultyForChest(17), random(42)),
    );
  } finally {
    vi.doUnmock("@/game/ruleset");
    vi.resetModules();
  }
});

it("samples early solution lengths instead of favoring the longest path in a window", () => {
  for (const [roll, target] of [
    [0, 2],
    [0.4, 3],
    [0.9, 4],
  ]) {
    let draw = 0;
    const config = getLearningProgression(0, () => (draw++ === 0 ? 0 : roll));
    expect(config.solutionLengthRange).toEqual([2, 4]);
    expect(config.minSolutionLength).toBe(target);
    expect(config.maxSolutionLength).toBe(target);
  }
  const mature = getLearningProgression(9999, () => 0);
  expect(mature.minSolutionLength).toBe(10);
  expect(mature.maxSolutionLength).toBe(16);
});

it("keeps new ore and saved learning cohorts on identical seeded generation", () => {
  for (const index of [0, 4, 17, 29, 99, 9999])
    expect(createChestLock(index, random(42), RULESET_VERSION)).toEqual(
      createChestLock(index, random(42), LEARNING_RULESET_VERSION),
    );
});
