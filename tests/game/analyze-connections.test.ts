import { describe, expect, it } from "vitest";
import { analyzeConnections } from "@/game/analyze-connections";
import type { MoveRule } from "@/game/types";

function rules(count: number, edges: [number, number][]): MoveRule[] {
  return Array.from({ length: count }, (_, sourcePinId) =>
    [1, -1].map(
      (direction): MoveRule => ({
        sourcePinId,
        direction: direction as 1 | -1,
        effects: [
          { pinId: sourcePinId, delta: direction as 1 | -1 },
          ...edges
            .filter(([source]) => source === sourcePinId)
            .map(([, pinId]) => ({ pinId, delta: -direction as 1 | -1 })),
        ],
      }),
    ),
  ).flat();
}
describe("connection analysis", () => {
  it("keeps seven plates with one connected pair Beginner", () => {
    expect(analyzeConnections(rules(7, [[0, 1]]))).toEqual({
      coreSize: 2,
      dependencies: 1,
      maxFanout: 1,
      tier: 1,
    });
  });
  it("counts reciprocal dependencies separately and excludes inverse/self effects", () => {
    expect(
      analyzeConnections(
        rules(4, [
          [0, 1],
          [1, 0],
        ]),
      ),
    ).toEqual({ coreSize: 2, dependencies: 2, maxFanout: 1, tier: 2 });
  });
  it("distinguishes separate pairs from a larger connected group", () => {
    expect(
      analyzeConnections(
        rules(4, [
          [0, 1],
          [2, 3],
        ]),
      ).coreSize,
    ).toBe(2);
    expect(
      analyzeConnections(
        rules(4, [
          [0, 1],
          [1, 2],
          [2, 3],
        ]),
      ).coreSize,
    ).toBe(4);
    expect(analyzeConnections(rules(4, [])).tier).toBe(1);
  });
  it("requires both a larger core and sufficient connections for the upper tiers", () => {
    expect(
      analyzeConnections(
        rules(4, [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0],
          [0, 2],
          [1, 3],
        ]),
      ).tier,
    ).toBe(3);
    const dense = Array.from(
      { length: 5 },
      (_, a) =>
        [
          [a, (a + 1) % 5],
          [a, (a + 2) % 5],
        ] as [number, number][],
    ).flat();
    expect(analyzeConnections(rules(5, dense)).tier).toBe(4);
  });
});
