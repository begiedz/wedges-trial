import { describe, expect, it } from "vitest";
import { getNextPinId } from "@/client/game/pinSelection";

describe("pin selection shared by gameplay and debug UI", () => {
  it("wraps in both directions using pin IDs rather than array indices", () => {
    const pins = [{ id: 10 }, { id: 30 }, { id: 80 }];
    expect(getNextPinId(pins, 10, -1)).toBe(80);
    expect(getNextPinId(pins, 80, 1)).toBe(10);
    expect(getNextPinId(pins, 30, 1)).toBe(80);
    expect(getNextPinId(pins, null, 1)).toBe(30);
    expect(getNextPinId([], null, 1)).toBeNull();
  });
});
