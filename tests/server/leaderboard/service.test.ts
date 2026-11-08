import { describe, expect, it, vi } from "vitest";
import { validateClaim } from "@/server/leaderboard/service";

vi.mock("@/server/db", () => ({ getDatabase: vi.fn() }));
const actionId = "12345678-1234-4234-8234-123456789012";
describe("private nickname claim validation", () => {
  it("normalizes Unicode names and counts code points", () => {
    expect(validateClaim({ actionId, nickname: "  Клин  " })).toEqual({
      actionId,
      nickname: "Клин",
    });
    expect(
      validateClaim({ actionId, nickname: "😀".repeat(24) }).nickname,
    ).toBe("😀".repeat(24));
  });
  it.each([
    null,
    [],
    {},
    { actionId, nickname: "" },
    { actionId, nickname: "  " },
    { actionId, nickname: "x".repeat(25) },
    { actionId, nickname: "a\nb" },
    { actionId, nickname: "a\u0000b" },
    { actionId, nickname: "a\u0085b" },
    { actionId, nickname: "\ud800" },
    { actionId: "bad", nickname: "Wedge" },
    { actionId, nickname: "Wedge", score: 100 },
    { actionId, nickname: "Wedge", ownerId: actionId },
    { actionId, nickname: "Wedge", expectedVersion: 1 },
    { actionId, nickname: 42 },
  ])("rejects malformed names, forged scores and ownership", (body) => {
    expect(() => validateClaim(body)).toThrow("INVALID_REQUEST");
  });
});
