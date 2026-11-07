import { afterEach, describe, expect, it, vi } from "vitest";
import { getLeaderboardPage } from "@/client/leaderboard";

const fetchMock = vi.fn();
const entry = {
  rank: 1,
  runId: "run-1",
  displayName: "Wedge",
  oreNuggets: 20,
  openedChests: 2,
  finishedAt: "2026-11-07T10:00:00Z",
};
const page = {
  rulesetVersion: "scarce-picks-v1",
  entries: [entry],
  nextCursor: null,
};
function respond(value: unknown, status = 200) {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify(value), { status }));
}
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
describe("public ranking HTTP client", () => {
  it("uses public API with ten entries and no session or score", async () => {
    respond(page);
    expect(await getLeaderboardPage(0)).toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leaderboard?limit=10",
      expect.objectContaining({
        credentials: "omit",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it("encodes opaque cursors and accepts the last rank", async () => {
    respond({
      ...page,
      entries: Array.from({ length: 10 }, (_, index) => ({
        ...entry,
        runId: `run-${991 + index}`,
        rank: 991 + index,
      })),
    });
    await getLeaderboardPage(99, "opaque&cursor");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/leaderboard?limit=10&cursor=opaque%26cursor",
    );
  });
  it.each([
    null,
    {},
    { ...page, entries: [{ ...entry, rank: 2 }] },
    { ...page, entries: [{ ...entry, finishedAt: "invalid" }] },
    { ...page, entries: [{ ...entry, oreNuggets: -1 }] },
    { ...page, nextCursor: 3 },
    { ...page, nextCursor: "cursor" },
    { ...page, entries: Array(11).fill(entry) },
  ])("rejects malformed page %j", async (value) => {
    respond(value);
    await expect(getLeaderboardPage(0)).rejects.toThrow("INVALID_RESPONSE");
  });
  it.each([400, 429, 503])("preserves status %i", async (status) => {
    respond({}, status);
    await expect(getLeaderboardPage(0)).rejects.toMatchObject({ status });
  });
});
