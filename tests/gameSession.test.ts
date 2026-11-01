// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunDto } from "@/api/contracts";
import { useGameSession } from "@/components/game/useGameSession";

export function fixture(): RunDto {
  return {
    id: "12345678-1234-4234-8234-123456789012",
    version: 1,
    rulesetVersion: "deterministic-ore-v1",
    status: "playing",
    chestIndex: 1,
    openedChests: 0,
    oreNuggets: 0,
    lockpicks: 3,
    difficulty: 1,
    currentLock: {
      pins: [{ id: 0, position: 1, target: 2, min: 0, max: 2 }],
      invalidMovesOnCurrentPick: 0,
      maxInvalidMovesPerPick: 3,
    },
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    reward: null,
    result: null,
  };
}
const fetchMock = vi.fn();
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubGlobal("WebSocket", undefined);
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function mounted() {
  fetchMock
    .mockResolvedValueOnce(ok({ ready: true }))
    .mockResolvedValueOnce(ok({ run: fixture() }));
  const hook = renderHook(useGameSession);
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}
describe("server-backed game session", () => {
  it("restores confirmed state and sends intent only, queueing rapid input", async () => {
    const { result } = await mounted();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    let work: unknown;
    fetchMock.mockResolvedValueOnce(ok({ run: { ...fixture(), version: 3 } }));
    act(() => {
      work = result.current.move(0, 1);
      void result.current.move(0, 1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(Object.keys(body).sort()).toEqual([
      "actionId",
      "direction",
      "expectedVersion",
      "pinId",
    ]);
    expect(result.current.run?.version).toBe(1);
    await act(async () => {
      resolve(ok({ run: { ...fixture(), version: 2 } }));
      await work;
    });
    await waitFor(() => expect(result.current.run?.version).toBe(3));
  });
  it("retains the exact action after an unknown commit and retries it", async () => {
    const { result } = await mounted();
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    await act(async () => {
      await result.current.move(0, -1);
    });
    await waitFor(() => expect(result.current.error).toBe(true));
    const sent = fetchMock.mock.calls[2][1].body;
    fetchMock
      .mockResolvedValueOnce(ok({ run: { ...fixture(), version: 2 } }))
      .mockResolvedValueOnce(ok({ run: { ...fixture(), version: 2 } }));
    await act(async () => {
      await result.current.retry();
    });
    expect(fetchMock.mock.calls[3][1].body).toBe(sent);
    await waitFor(() => expect(result.current.run?.version).toBe(2));
    expect(result.current.error).toBe(false);
  });
  it("recovers stale-version conflicts without resubmitting the move", async () => {
    const { result } = await mounted();
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 409 }))
      .mockResolvedValueOnce(ok({ run: { ...fixture(), version: 7 } }));
    await act(async () => {
      await result.current.move(0, 1);
    });
    await waitFor(() => expect(result.current.run?.version).toBe(7));
    expect(fetchMock.mock.calls[3][1].method).toBe("GET");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("restores pending reward after refresh without computing it locally", async () => {
    const opened: RunDto = {
      ...fixture(),
      status: "chest_opened",
      reward: { oreNuggets: 8, lockpicks: 1 },
      result: null,
    };
    fetchMock
      .mockResolvedValueOnce(ok({ ready: true }))
      .mockResolvedValueOnce(ok({ run: opened }));
    const { result } = renderHook(useGameSession);
    await waitFor(() => expect(result.current.rewardOpen).toBe(true));
    expect(result.current.reward).toEqual(opened.reward);
  });
});
