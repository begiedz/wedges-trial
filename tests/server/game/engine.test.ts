import { describe, expect, it, vi } from "vitest";
import { getDeterministicOre } from "@/game/rewards";
import { LEGACY_RULESET_VERSION, RULESET_VERSION } from "@/game/ruleset";
import { newRun, publicRun, transition } from "@/server/game/engine";

function fixture() {
  const run = newRun("run", "owner");
  run.game.state.lockpicks = 3; // Exercise damage/reset with a multi-pick inventory.
  run.game.state.currentLock = {
    optimalMoves: 2,
    pins: [{ id: 0, position: 0, min: 0, max: 2, target: 2 }],
    rules: [1, -1].map((direction) => ({
      sourcePinId: 0,
      direction: direction as 1 | -1,
      effects: [{ pinId: 0, delta: direction as 1 | -1 }],
    })),
    isSolved: false,
    isFailed: false,
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: 4,
  };
  run.game.initialLock = structuredClone(run.game.state.currentLock);
  return run;
}
describe("authoritative domain lifecycle", () => {
  it.each([1, 2, 3])(
    "preserves %i damage and cumulative penalties through repeated resets",
    (mistakes) => {
      let run = fixture();
      for (let i = 0; i < mistakes; i++)
        run = transition(run, "move", { pinId: 0, direction: -1 }).run;
      run = transition(transition(run, "reset", {}).run, "reset", {}).run;
      expect(run.game.state.currentLock.invalidMovesOnCurrentPick).toBe(
        mistakes,
      );
      expect(run.game.chestMetrics.invalidMoves).toBe(mistakes);
      for (let i = mistakes; i < 4; i++)
        run = transition(run, "move", { pinId: 0, direction: -1 }).run;
      expect(run.game.state.lockpicks).toBe(2);
      expect(run.game.totalMetrics.brokenPicks).toBe(1);
      expect(run.game.state.currentLock.pins[0].position).toBe(0);
    },
  );
  it("stores reward at solve, credits once at continue and carries pick damage", () => {
    let run = fixture();
    run = transition(run, "move", { pinId: 0, direction: -1 }).run;
    run = transition(run, "move", { pinId: 0, direction: 1 }).run;
    run = transition(run, "move", { pinId: 0, direction: 1 }).run;
    expect(run.status).toBe("chest_opened");
    expect(run.game.reward?.oreNuggets).toBe(9);
    expect(run.game.state.oreNuggets).toBe(0);
    expect(() => transition(run, "reset", {})).toThrow();
    const next = transition(run, "continue", {}).run;
    expect(next.game.state.oreNuggets).toBe(9);
    expect(next.game.state.currentLock.invalidMovesOnCurrentPick).toBe(1);
    expect(next.game.chestMetrics.moves).toBe(0);
    expect(next.game.totalMetrics.moves).toBe(3);
    expect(() => transition(next, "continue", {})).toThrow();
  });
  it("freezes final statistics on last pick and hides solver metadata", () => {
    let run = fixture();
    run.game.state.lockpicks = 1;
    for (let i = 0; i < 4; i++)
      run = transition(run, "move", { pinId: 0, direction: -1 }).run;
    run.game.state.currentLock.optimalMoves = 2;
    const dto = publicRun(run);
    expect(dto.status).toBe("finished");
    expect(dto.result?.reason).toBe("lockpicks_exhausted");
    expect(dto.result?.totalMetrics).toEqual({
      moves: 4,
      invalidMoves: 4,
      brokenPicks: 1,
    });
    expect(dto.result?.totalMetrics).not.toBe(run.game.totalMetrics);
    expect(JSON.stringify(dto)).not.toMatch(
      /"rules"|ownerId|initialLock|chestMetrics|optimalMoves/,
    );
    for (const action of ["move", "reset", "continue", "abandon"] as const)
      expect(() =>
        transition(run, action, { pinId: 0, direction: 1 }),
      ).toThrow();
  });
  it("counts valid and invalid moves once, preserves all counters on reset, and clears only chest counters on continue", () => {
    let run = fixture();
    const move = (direction: 1 | -1) => {
      run = transition(run, "move", { pinId: 0, direction }).run;
    };
    move(1);
    expect(run.game.state.currentLock.optimalMoves).toBe(2);
    move(-1);
    for (let i = 0; i < 5; i++) move(-1);
    const metrics = { moves: 7, invalidMoves: 5, brokenPicks: 1 };
    expect(run.game.chestMetrics).toEqual(metrics);
    expect(run.game.totalMetrics).toEqual(metrics);
    expect(run.game.state.currentLock.invalidMovesOnCurrentPick).toBe(1);
    run = transition(run, "reset", {}).run;
    expect(run.game.state.currentLock.optimalMoves).toBe(2);
    expect(run.game.initialLock.optimalMoves).toBe(2);
    expect(run.game.chestMetrics).toEqual(metrics);
    expect(run.game.totalMetrics).toEqual(metrics);
    move(1);
    move(1);
    expect(run.game.reward?.oreNuggets).toBe(5);
    run = transition(run, "continue", {}).run;
    expect(run.game.chestMetrics).toEqual({
      moves: 0,
      invalidMoves: 0,
      brokenPicks: 0,
    });
    expect(run.game.totalMetrics).toEqual({ ...metrics, moves: 9 });
    expect(run.game.state.currentLock.invalidMovesOnCurrentPick).toBe(1);
  });
  it("does not count unknown pins, missing rules, solved or failed moves", () => {
    const run = fixture();
    expect(() =>
      transition(run, "move", { pinId: 99, direction: 1 }),
    ).toThrow();
    run.game.state.currentLock.rules = [];
    expect(() => transition(run, "move", { pinId: 0, direction: 1 })).toThrow();
    for (const flag of ["isSolved", "isFailed"] as const) {
      const terminal = fixture();
      terminal.game.state.currentLock[flag] = true;
      expect(() =>
        transition(terminal, "move", { pinId: 0, direction: 1 }),
      ).toThrow();
      expect(terminal.game.totalMetrics.moves).toBe(0);
    }
    expect(run.game.totalMetrics.moves).toBe(0);
  });
  it("has deterministic monotonic ore and a forty-percent floor", () => {
    expect(getDeterministicOre(1, 0)).toBe(10);
    expect(getDeterministicOre(2, 0)).toBe(15);
    expect(getDeterministicOre(1, 100)).toBe(4);
    for (let chest = 1; chest < 100; chest++)
      for (let misses = 1; misses < 15; misses++)
        expect(getDeterministicOre(chest, misses)).toBeLessThanOrEqual(
          getDeterministicOre(chest, misses - 1),
        );
  });
});

it.each([
  [5, 5],
  [12, 6],
  [24, 7],
] as const)(
  "continues displayed chest %i into a lock with %i plates and correct band",
  (chest, plates) => {
    const run = fixture();
    run.game.state.chestIndex = chest;
    run.status = "chest_opened";
    run.game.reward = { oreNuggets: 0, lockpicks: 0 };
    run.game.state.currentLock.invalidMovesOnCurrentPick = 3;
    const next = transition(run, "continue", {}).response.run;
    expect(next.chestIndex).toBe(chest + 1);
    expect(next.difficulty).toBe(plates - 3);
    expect(next.currentLock.pins).toHaveLength(plates);
    expect(next.currentLock).toMatchObject({
      maxInvalidMovesPerPick: 4,
      invalidMovesOnCurrentPick: 3,
    });
  },
);

it("starts with one pick and ends after its fourth invalid move", () => {
  const fresh = newRun("fresh", "owner");
  expect(fresh.game.state.lockpicks).toBe(1);
  expect(fresh.rulesetVersion).toBe(RULESET_VERSION);
  let run = fixture();
  run.game.state.lockpicks = fresh.game.state.lockpicks;
  for (let i = 0; i < 4; i++)
    run = transition(run, "move", { pinId: 0, direction: -1 }).run;
  expect(run.status).toBe("finished");
  expect(run.game.state.lockpicks).toBe(0);
  expect(run.game.reward).toBeNull();
});
it("selects the correct drop table without changing saved or pending inventory", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0.75);
  try {
    for (const [version, expected] of [
      [RULESET_VERSION, 0],
      [LEGACY_RULESET_VERSION, 1],
    ] as const) {
      let run = fixture();
      run.rulesetVersion = version;
      run = transition(run, "move", { pinId: 0, direction: 1 }).run;
      run = transition(run, "move", { pinId: 0, direction: 1 }).run;
      expect(run.game.reward?.lockpicks).toBe(expected);
      expect(run.game.state.lockpicks).toBe(3);
      run = transition(run, "continue", {}).run;
      expect(run.game.state.lockpicks).toBe(3 + expected);
      expect(run.rulesetVersion).toBe(version);
    }
  } finally {
    random.mockRestore();
  }
});
