import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLeaderboardEligibility,
  submitLeaderboardEntry,
} from "@/client/game/leaderboard";
import { newRun, publicRun } from "@/server/game/engine";

const runId = "12345678-1234-4234-8234-123456789012";
const input = {
  actionId: "12345678-1234-4234-8234-123456789013",
  nickname: "Wedge",
};
const fetchMock = vi.fn();
function respond(value: unknown, status = 200) {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify(value), { status }));
}
function claimed() {
  const stored = newRun(runId, "owner");
  stored.status = "finished";
  stored.game.finishedAt = new Date(0).toISOString();
  stored.game.state.lockpicks = 0;
  stored.game.state.currentLock.isFailed = true;
  return {
    run: publicRun(stored),
    outcome: "leaderboard_claimed",
    entry: {
      rank: 1,
      runId,
      displayName: "Wedge",
      oreNuggets: 0,
      openedChests: 0,
      finishedAt: new Date(0).toISOString(),
    },
  };
}
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
describe("private ranking HTTP boundary", () => {
  it("reads qualification without cache and authenticates same-origin", async () => {
    respond({ eligible: true, rank: 1000 });
    expect(await getLeaderboardEligibility(runId)).toEqual({
      eligible: true,
      rank: 1000,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/runs/${runId}/leaderboard-eligibility`,
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it.each([
    null,
    {},
    { eligible: true, rank: 1001 },
    { eligible: true, rank: 0 },
    { eligible: true, rank: "1" },
    { eligible: false, reason: "other" },
  ])("rejects malformed qualification %j", async (value) => {
    respond(value);
    await expect(getLeaderboardEligibility(runId)).rejects.toThrow(
      "INVALID_RESPONSE",
    );
  });
  it("submits only the captured action and nickname and validates the finished reply", async () => {
    const value = claimed();
    respond(value);
    expect(await submitLeaderboardEntry(runId, input)).toEqual(value);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/runs/${runId}/leaderboard-entry`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });
  it("accepts the atomic cutoff rejection", async () => {
    const value = {
      run: claimed().run,
      outcome: "leaderboard_not_qualified",
      qualification: { eligible: false, reason: "below_cutoff" },
    };
    respond(value);
    expect(await submitLeaderboardEntry(runId, input)).toEqual(value);
  });
  it.each([401, 400, 403, 404, 409, 500])(
    "preserves HTTP status %i",
    async (status) => {
      respond({}, status);
      await expect(submitLeaderboardEntry(runId, input)).rejects.toMatchObject({
        status,
      });
    },
  );
  it.each([
    "wrong-run",
    "wrong-score",
    "missing-entry",
    "nonterminal",
    "unknown-outcome",
  ])("rejects %s responses", async (kind) => {
    const value = claimed();
    const invalid =
      kind === "wrong-run"
        ? { ...value, run: { ...value.run, id: "other" } }
        : kind === "wrong-score"
          ? { ...value, entry: { ...value.entry, oreNuggets: 99 } }
          : kind === "missing-entry"
            ? { ...value, entry: null }
            : kind === "nonterminal"
              ? {
                  ...value,
                  run: { ...value.run, status: "playing", result: null },
                }
              : { ...value, outcome: "unknown" };
    respond(invalid);
    await expect(submitLeaderboardEntry(runId, input)).rejects.toThrow(
      "INVALID_RESPONSE",
    );
  });
});
