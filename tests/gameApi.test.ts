import { describe, expect, it, vi } from "vitest";
import { GameApiClient, TransportError } from "@/client/game/api";
import { isRunDto } from "@/client/game/response";
import { runDto } from "./fixtures/run";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
describe("HTTP response boundary", () => {
  it("uses same-origin credentials, no-store and JSON intent bodies", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ run: runDto() }));
    const api = new GameApiClient(fetcher);
    await api.request("/api/runs", { actionId: "intent" });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/runs",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: '{"actionId":"intent"}',
      }),
    );
  });
  it.each([
    null,
    [],
    { run: {} },
    { run: { ...runDto(), status: "unknown" } },
    { run: { ...runDto(), lockpicks: -1 } },
    {
      run: {
        ...runDto(),
        currentLock: { ...runDto().currentLock, pins: [{ id: 0 }] },
      },
    },
    { run: { ...runDto(), status: "chest_opened", reward: null } },
  ])("rejects malformed run snapshots %j", async (value) => {
    const api = new GameApiClient(
      vi.fn<typeof fetch>().mockResolvedValue(json(value)),
    );
    await expect(api.current()).rejects.toThrow("INVALID_RESPONSE");
  });
  it("validates final statistics and supports original legacy replay responses", () => {
    const finished = {
      ...runDto(),
      status: "finished",
      reward: null,
      result: {
        oreNuggets: 10,
        openedChests: 1,
        finishedAt: new Date(0).toISOString(),
        reason: "lockpicks_exhausted",
      },
    };
    expect(isRunDto(finished)).toBe(true);
    for (const totalMetrics of [
      { moves: 12, invalidMoves: 3, brokenPicks: 1 },
      null,
      {},
      { moves: -1, invalidMoves: 3, brokenPicks: 1 },
      { moves: 12, invalidMoves: 1.5, brokenPicks: 1 },
      { moves: 12, invalidMoves: 3, brokenPicks: "1" },
    ]) {
      expect(
        isRunDto({ ...finished, result: { ...finished.result, totalMetrics } }),
      ).toBe(
        totalMetrics !== null &&
          totalMetrics.moves === 12 &&
          totalMetrics.invalidMoves === 3 &&
          totalMetrics.brokenPicks === 1,
      );
    }
  });
  it("permits no active run and validates session readiness", async () => {
    const api = new GameApiClient(
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ run: null }))
        .mockResolvedValueOnce(json({ ready: true }))
        .mockResolvedValueOnce(json({ ready: false })),
    );
    expect(await api.current()).toEqual({ run: null });
    await expect(api.bootstrap()).resolves.toEqual({ run: null });
    await expect(api.bootstrap()).rejects.toThrow("INVALID_RESPONSE");
  });
  it("preserves HTTP status for conflict/retry decisions", async () => {
    const api = new GameApiClient(
      vi.fn<typeof fetch>().mockResolvedValue(json({}, 409)),
    );
    await expect(api.current()).rejects.toEqual(new TransportError(409));
  });
});
