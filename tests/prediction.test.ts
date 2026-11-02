import { describe, expect, it } from "vitest";
import { predictRun } from "@/client/game/prediction";
import { publicRun, transition } from "@/server/game/engine";
import { moveCommand, storedRun } from "./fixtures/run";

describe("visual prediction/domain parity", () => {
  it.each([
    [-1, -1, -1, 1, -1, -1, -1],
    [1, 1, 1, 1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, 1],
  ] as const)(
    "matches server positions and damage for sequence %j",
    (...directions) => {
      const initial = storedRun();
      let server = initial;
      const commands = directions.map((direction, i) =>
        moveCommand(i + 1, direction),
      );
      for (const command of commands) {
        if (server.status !== "playing") break;
        server = transition(server, "move", command.body).run;
      }
      const confirmed = publicRun(initial);
      const before = structuredClone(confirmed);
      const predicted = predictRun(confirmed, commands);
      expect(predicted.run.currentLock.pins).toEqual(
        server.game.state.currentLock.pins,
      );
      expect(predicted.run.currentLock.invalidMovesOnCurrentPick).toBe(
        server.game.state.currentLock.invalidMovesOnCurrentPick,
      );
      expect(predicted.terminal).toBe(server.status !== "playing");
      expect(predicted.run.lockpicks).toBe(confirmed.lockpicks);
      expect(predicted.run.status).toBe("playing");
      expect(predicted.run.reward).toBeNull();
      expect(predicted.run.oreNuggets).toBe(confirmed.oreNuggets);
      expect(confirmed).toEqual(before);
    },
  );
  it("preserves partial damage after reset and continuation", () => {
    let server = storedRun();
    server = transition(server, "move", { pinId: 0, direction: -1 }).run;
    server = transition(server, "reset", {}).run;
    const predicted = predictRun(publicRun(server), [
      moveCommand(server.version, -1),
    ]);
    expect(predicted.run.currentLock.invalidMovesOnCurrentPick).toBe(2);
    for (let i = 0; i < 4; i++)
      server = transition(server, "move", { pinId: 0, direction: 1 }).run;
    server = transition(server, "continue", {}).run;
    const pin = server.game.state.currentLock.pins[0];
    pin.position = pin.min;
    const next = predictRun(publicRun(server), [
      moveCommand(server.version, -1),
    ]);
    const committed = transition(server, "move", {
      pinId: 0,
      direction: -1,
    }).run;
    expect(next.run.currentLock.invalidMovesOnCurrentPick).toBe(
      committed.game.state.currentLock.invalidMovesOnCurrentPick,
    );
  });
});
