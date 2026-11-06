import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/leaderboard/route";
import { GameError } from "@/server/game/errors";
import { readLeaderboard } from "@/server/leaderboard/pagination";

vi.mock("@/server/leaderboard/pagination", () => ({
  readLeaderboard: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
describe("public leaderboard HTTP", () => {
  it("reads without credentials and prevents caching", async () => {
    const body = { rulesetVersion: "test", entries: [], nextCursor: null };
    vi.mocked(readLeaderboard).mockResolvedValueOnce(body);
    const response = await GET(
      new Request("https://trial.test/api/leaderboard?limit=1"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(await response.json()).toEqual(body);
    expect(vi.mocked(readLeaderboard).mock.calls.at(-1)?.[0].get("limit")).toBe(
      "1",
    );
  });
  it("returns safe cursor errors and unavailable responses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const error of [
      new GameError("INVALID_CURSOR", 400),
      new Error("private database details"),
    ]) {
      vi.mocked(readLeaderboard).mockRejectedValueOnce(error);
      const response = await GET(
        new Request("https://trial.test/api/leaderboard"),
      );
      expect(response.status).toBe(error instanceof GameError ? 400 : 503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.json();
      expect(body.error.code).toBe(
        error instanceof GameError ? "INVALID_CURSOR" : "SERVICE_UNAVAILABLE",
      );
      expect(body.error.requestId).toMatch(/^[a-f0-9-]{36}$/);
      expect(JSON.stringify(body)).not.toContain("private");
    }
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "private database details",
    );
  });
});
