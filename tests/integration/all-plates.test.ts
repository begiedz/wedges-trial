import { describe, expect, it, vi } from "vitest";
import { analyzeConnections } from "@/game/analyze-connections";
import { checkSolved } from "@/game/check-solved";
import { createChestLock, createLockWithDiagnostics } from "@/game/create-lock";
import { generateRules } from "@/game/generate-rules";
import { getLearningProgression } from "@/game/learning-progression";
import {
  ALL_PLATES_RULESET_VERSION,
  DIFFICULTY_ORE_RULESET_VERSION,
} from "@/game/ruleset";
import * as solver from "@/game/solver";

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
function coupledIds(rules: ReturnType<typeof generateRules>) {
  return new Set(
    rules.flatMap((rule) =>
      rule.effects.length > 1 ? rule.effects.map((effect) => effect.pinId) : [],
    ),
  );
}

describe("all plates generation", () => {
  it.each([4, 5, 6, 7])(
    "selects the connected pair uniformly across %i plates",
    (plateCount) => {
      const counts = Array<number>(plateCount).fill(0);
      for (let seed = 0; seed < 1000; seed++) {
        const config = {
          ...getLearningProgression(0, random(seed)),
          plateCount,
          mixAllPlates: true,
        };
        const rules = generateRules(config, random(seed * 100003));
        expect(analyzeConnections(rules)).toMatchObject({
          coreSize: 2,
          dependencies: 1,
        });
        for (const id of coupledIds(rules)) counts[id]++;
      }
      const expected = 2000 / plateCount;
      for (const count of counts)
        expect(Math.abs(count - expected)).toBeLessThan(expected * 0.15);
    },
  );

  it.each([0, 7, 11, 17, 23, 29, 49, 99, 9999])(
    "scrambles independent plates and preserves proven solutions at chest index %i",
    (index) => {
      for (const seed of [1, 7, 42]) {
        const rng = random(seed);
        const config = {
          ...getLearningProgression(index, rng),
          mixAllPlates: true,
        };
        const { lock, solution } = createLockWithDiagnostics(config, rng);
        const coupled = coupledIds(lock.rules);
        for (const pin of lock.pins)
          if (!coupled.has(pin.id))
            expect(pin.position).toBeGreaterThanOrEqual(pin.min);
        expect(checkSolved(lock)).toBe(false);
        expect(solver.verifySolution(lock, solution)).toBe(true);
        const search = solver.solveLockDetailed(lock);
        if (search.kind === "found" && lock.optimalMoves != null)
          expect(lock.optimalMoves).toBe(search.solution.length);
        expect(createChestLock(index, random(seed))).toEqual(
          createChestLock(index, random(seed), ALL_PLATES_RULESET_VERSION),
        );
      }
    },
  );

  it("keeps independent plates scrambled even when every search exhausts its budget", () => {
    const spy = vi
      .spyOn(solver, "solveLockDetailed")
      .mockReturnValue({ kind: "budget-exhausted", visitedStates: 20000 });
    try {
      const rng = random(42);
      const config = {
        ...getLearningProgression(0, rng),
        plateCount: 7,
        mixAllPlates: true,
      };
      const { lock, solution } = createLockWithDiagnostics(config, rng);
      expect(lock.optimalMoves).toBeNull();
      for (const pin of lock.pins)
        if (!coupledIds(lock.rules).has(pin.id))
          expect(pin.position).toBeGreaterThanOrEqual(pin.min);
      expect(checkSolved(lock)).toBe(false);
      expect(solver.verifySolution(lock, solution)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it.each([false, true])(
    "samples every independent position, including center (fallback=%s)",
    (fallback) => {
      const spy = fallback
        ? vi
            .spyOn(solver, "solveLockDetailed")
            .mockReturnValue({ kind: "budget-exhausted", visitedStates: 20000 })
        : undefined;
      try {
        const counts = Array<number>(7).fill(0);
        for (let seed = 0; seed < 140; seed++) {
          const rng = random(seed * 100003);
          const config = {
            ...getLearningProgression(0, rng),
            plateCount: 7,
            mixAllPlates: true,
          };
          const { lock, solution } = createLockWithDiagnostics(config, rng);
          const coupled = coupledIds(lock.rules);
          for (const pin of lock.pins)
            if (!coupled.has(pin.id)) counts[pin.position]++;
          expect(checkSolved(lock)).toBe(false);
          expect(solver.verifySolution(lock, solution)).toBe(true);
        }
        // 140 locks * 5 independent plates: about 100 samples per position.
        for (const count of counts) expect(count).toBeGreaterThan(60);
        for (const count of counts) expect(count).toBeLessThan(140);
      } finally {
        spy?.mockRestore();
      }
    },
  );

  it("keeps centered independent draws when they would otherwise solve the whole lock", () => {
    const solve = solver.solveLockDetailed;
    let finishing = false;
    const rng = () => (finishing ? 0.5 : 0.99);
    const spy = vi
      .spyOn(solver, "solveLockDetailed")
      .mockImplementation((lock) => {
        const result = solve(lock);
        finishing = true;
        return result;
      });
    try {
      const config = {
        ...getLearningProgression(0, rng),
        mixAllPlates: true,
        guaranteedSolvableMoves: 1,
        minSolutionLength: 1,
        maxSolutionLength: 1,
      };
      const { lock, solution } = createLockWithDiagnostics(config, rng);
      for (const pin of lock.pins)
        if (!coupledIds(lock.rules).has(pin.id))
          expect(pin.position).toBe(pin.target);
      expect(checkSolved(lock)).toBe(false);
      expect(solution).toHaveLength(1);
      expect(coupledIds(lock.rules).has(solution[0].pinId)).toBe(true);
      expect(solver.verifySolution(lock, solution)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("preserves the saved difficulty-ore generator", () => {
    const rng = random(42);
    expect(
      createChestLock(17, random(42), DIFFICULTY_ORE_RULESET_VERSION),
    ).toEqual(
      createLockWithDiagnostics(getLearningProgression(17, rng), rng).lock,
    );
  });
});
