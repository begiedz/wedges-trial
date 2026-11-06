import { describe, expect, it } from "vitest";
import { isRunDto } from "@/client/game/response";
import { runDto } from "../../fixtures/run";

describe("four-mistake durability snapshots", () => {
  it("accepts partial damage and rejects exhausted damage or other thresholds", () => {
    const run = runDto();
    run.currentLock.invalidMovesOnCurrentPick = 3;
    expect(isRunDto(run)).toBe(true);
    run.currentLock.invalidMovesOnCurrentPick = 4;
    expect(isRunDto(run)).toBe(false);
    for (const maximum of [3, 5]) {
      expect(
        isRunDto({
          ...run,
          currentLock: {
            ...run.currentLock,
            invalidMovesOnCurrentPick: 0,
            maxInvalidMovesPerPick: maximum,
          },
        }),
      ).toBe(false);
    }
  });
});
