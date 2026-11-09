import { describe, expect, it, vi } from "vitest";
import { validateQuery } from "@/server/leaderboard/pagination";

vi.mock("@/server/db", () => ({ getDatabase: vi.fn() }));

describe("public leaderboard query", () => {
  it("defaults to 25 and accepts independent page sizes", () => {
    expect(validateQuery(new URLSearchParams())).toEqual({ limit: 25 });
    for (const limit of [1, 25, 100])
      expect(
        validateQuery(new URLSearchParams({ limit: String(limit) })),
      ).toEqual({ limit });
  });
  it("accepts bounded live offsets", () => {
    for (const cursor of ["1", "25", "999"])
      expect(validateQuery(new URLSearchParams({ cursor }))).toEqual({
        limit: 25,
        cursor,
      });
  });
  it.each([
    "limit=0",
    "limit=101",
    "limit=-1",
    "limit=1.5",
    "limit=1e2",
    "limit=",
    "limit=NaN",
    "limit=25&limit=25",
    "score=1",
    "cursor=x&cursor=y",
  ])("rejects invalid query %s", (query) => {
    expect(() => validateQuery(new URLSearchParams(query))).toThrow(
      "INVALID_REQUEST",
    );
  });
  it.each([
    "",
    "x",
    "0",
    "01",
    "1000",
    "-1",
    "1.5",
    "x".repeat(5000),
    `00000000-0000-0000-0000-000000000000.0.${"a".repeat(64)}`,
    `${"-".repeat(36)}.25.${"a".repeat(64)}`,
  ])("rejects malformed cursors", (cursor) => {
    expect(() => validateQuery(new URLSearchParams({ cursor }))).toThrow(
      "INVALID_CURSOR",
    );
  });
});
