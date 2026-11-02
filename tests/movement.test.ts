import { describe, expect, it } from "vitest";
import { evaluateRule } from "@/game/movement";
import { storedRun } from "./fixtures/run";

describe("shared movement evaluation", () => {
  it("applies accumulated effects atomically, checking final bounds", () => {
    const pins = storedRun().game.state.currentLock.pins;
    const result = evaluateRule(pins, {
      sourcePinId: 0,
      direction: 1,
      effects: [
        { pinId: 0, delta: -1 },
        { pinId: 0, delta: 1 },
      ],
    });
    expect(result.kind).toBe("valid");
    expect(result.pins[0].position).toBe(0);
    expect(pins[0].position).toBe(0);
  });
  it("does not partially change pins on invalid bounds or missing effects", () => {
    const pins = storedRun().game.state.currentLock.pins;
    expect(
      evaluateRule(pins, {
        sourcePinId: 0,
        direction: -1,
        effects: [{ pinId: 0, delta: -1 }],
      }),
    ).toEqual({ kind: "invalid", pins });
    expect(
      evaluateRule(pins, {
        sourcePinId: 0,
        direction: 1,
        effects: [
          { pinId: 0, delta: 1 },
          { pinId: 99, delta: 1 },
        ],
      }),
    ).toEqual({ kind: "ignored", pins });
    expect(pins[0].position).toBe(0);
  });
});
