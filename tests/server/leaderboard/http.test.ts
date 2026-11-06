import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/leaderboard/route";
import { GameError } from "@/server/game/errors";
import { readLeaderboard } from "@/server/leaderboard/pagination";
import {
  LeaderboardRateLimitError,
  limitLeaderboard,
} from "@/server/leaderboard/rate-limit";

vi.mock("@/server/leaderboard/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/leaderboard/rate-limit")>()),
  limitLeaderboard: vi.fn(),
}));
vi.mock("@/server/db", () => ({ getDatabase: vi.fn() }));

vi.mock("@/server/leaderboard/pagination", () => ({
  readLeaderboard: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
describe("public leaderboard HTTP", () => {
  it("rejects excess requests before reading ranking and supplies retry timing", async () => {
    vi.mocked(readLeaderboard).mockClear();
    vi.mocked(limitLeaderboard).mockRejectedValueOnce(
      new LeaderboardRateLimitError(42),
    );
    const response = await GET(
      new Request("https://trial.test/api/leaderboard"),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).error.code).toBe("RATE_LIMITED");
    expect(readLeaderboard).not.toHaveBeenCalled();
  });
  it("uses separate global budgets for new traversals and cursor pages", async () => {
    for (const [query, operation] of [
      ["", "snapshot"],
      ["?cursor=bad", "page"],
    ]) {
      vi.mocked(readLeaderboard).mockResolvedValueOnce({
        rulesetVersion: "test",
        entries: [],
        nextCursor: null,
      });
      await GET(new Request(`https://trial.test/api/leaderboard${query}`));
      expect(limitLeaderboard).toHaveBeenLastCalledWith({ operation });
    }
  });
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
