import { describe, expect, it } from "vitest";
import { getDeterministicOre } from "@/game/rewards";
import { newRun, publicRun, transition } from "@/server/game/engine";

function fixture() {
  const run = newRun("run", "owner");
  run.game.state.currentLock = {
    pins: [{ id: 0, position: 0, min: 0, max: 2, target: 2 }],
    rules: [1, -1].map((direction) => ({
      sourcePinId: 0,
      direction: direction as 1 | -1,
      effects: [{ pinId: 0, delta: direction as 1 | -1 }],
    })),
    isSolved: false,
    isFailed: false,
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: 3,
  };
  run.game.initialLock = structuredClone(run.game.state.currentLock);
  return run;
}
describe("authoritative domain lifecycle", () => {
  it.each([1, 2])(
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
      for (let i = mistakes; i < 3; i++)
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
  it("freezes final result on last pick and hides rules and internal metrics", () => {
    let run = fixture();
    run.game.state.lockpicks = 1;
    for (let i = 0; i < 3; i++)
      run = transition(run, "move", { pinId: 0, direction: -1 }).run;
    const dto = publicRun(run);
    expect(dto.status).toBe("finished");
    expect(dto.result?.reason).toBe("lockpicks_exhausted");
    expect(JSON.stringify(dto)).not.toMatch(
      /"rules"|ownerId|initialLock|chestMetrics/,
    );
    for (const action of ["move", "reset", "continue", "abandon"] as const)
      expect(() =>
        transition(run, action, { pinId: 0, direction: 1 }),
      ).toThrow();
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
