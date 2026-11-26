import { afterEach, describe, expect, it, vi } from "vitest";
import { GameApiClient } from "@/client/game/api";
import { GameSession } from "@/client/game/session";
import { runDto } from "../../fixtures/run";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const sessions: GameSession[] = [];
function setup(fetcher: typeof fetch, id: string | null = null) {
  vi.stubGlobal("WebSocket", undefined);
  const session = new GameSession(new GameApiClient(fetcher), {
    restoredRunId: () => id,
  });
  sessions.push(session);
  session.start();
  return session;
}
afterEach(() => {
  for (const session of sessions.splice(0)) session.close();
  vi.unstubAllGlobals();
});
describe("session application lifecycle without React", () => {
  it("restores a finished run from the URL adapter without creating a new run", async () => {
    const run = {
      ...runDto(),
      status: "finished",
      lockpicks: 0,
      result: {
        oreNuggets: 0,
        openedChests: 0,
        finishedAt: new Date(0).toISOString(),
        reason: "lockpicks_exhausted",
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ ready: true }))
      .mockResolvedValueOnce(json({ run: null }))
      .mockResolvedValueOnce(json({ run }));
    const session = setup(fetcher, run.id);
    await vi.waitFor(() => expect(session.getSnapshot().loading).toBe(false));
    expect(session.getSnapshot().run?.status).toBe("finished");
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      "/api/players/session",
      "/api/runs/current",
      `/api/runs/${run.id}`,
    ]);
  });
  it("retries an unknown restart commit with the exact same action and finishes the restart", async () => {
    const old = runDto();
    const next = { ...old, id: "22345678-1234-4234-8234-123456789012" };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ ready: true }))
      .mockResolvedValueOnce(json({ run: old }));
    const session = setup(fetcher);
    await vi.waitFor(() => expect(session.getSnapshot().loading).toBe(false));
    fetcher.mockRejectedValueOnce(new TypeError("unknown commit"));
    await session.startNewRun();
    expect(session.getSnapshot().error).toBe(true);
    const original = fetcher.mock.calls[2];
    fetcher
      .mockResolvedValueOnce(
        json({ run: { ...old, version: 2, status: "abandoned" } }),
      )
      .mockResolvedValueOnce(json({ run: next }));
    await session.retry();
    expect(fetcher.mock.calls[3][0]).toBe(original[0]);
    expect(fetcher.mock.calls[3][1]?.body).toBe(original[1]?.body);
    expect(session.getSnapshot()).toMatchObject({
      run: next,
      loading: false,
      error: false,
    });
  });
  it("finishes restart after a lost abandon reply resynchronizes to the abandoned run", async () => {
    const old = runDto();
    const abandoned = { ...old, version: 2, status: "abandoned" };
    const next = { ...old, id: "22345678-1234-4234-8234-123456789012" };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ ready: true }))
      .mockResolvedValueOnce(json({ run: old }));
    const session = setup(fetcher);
    await vi.waitFor(() => expect(session.getSnapshot().loading).toBe(false));
    fetcher.mockRejectedValueOnce(new TypeError("lost abandon reply"));
    await session.startNewRun();
    const original = fetcher.mock.calls[2];
    fetcher
      .mockResolvedValueOnce(json({ error: { code: "VERSION_CONFLICT" } }, 409))
      .mockResolvedValueOnce(json({ run: abandoned }))
      .mockResolvedValueOnce(json({ run: next }));
    await session.retry();
    expect(fetcher.mock.calls[3][1]?.body).toBe(original[1]?.body);
    expect(fetcher.mock.calls[4][0]).toBe(`/api/runs/${old.id}`);
    expect(fetcher.mock.calls[5][0]).toBe("/api/runs");
    expect(session.getSnapshot()).toMatchObject({
      run: next,
      error: false,
      loading: false,
    });
  });
  it("deduplicates chest collection and retries an unknown commit with the original action", async () => {
    const initial = runDto();
    const opened = {
      ...initial,
      status: "chest_opened",
      reward: { oreNuggets: 10, lockpicks: 1 },
    };
    const continued = {
      ...initial,
      version: 2,
      chestIndex: 2,
      oreNuggets: 10,
      lockpicks: initial.lockpicks + 1,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ ready: true }))
      .mockResolvedValueOnce(json({ run: opened }));
    const session = setup(fetcher);
    await vi.waitFor(() => expect(session.getSnapshot().loading).toBe(false));
    let reject!: (error: Error) => void;
    fetcher.mockReturnValueOnce(
      new Promise<Response>((_, fail) => {
        reject = fail;
      }),
    );
    const collecting = session.continueToNextChest();
    await session.continueToNextChest();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(session.getSnapshot().run?.oreNuggets).toBe(0);
    const original = fetcher.mock.calls[2];
    expect(original[0]).toBe(`/api/runs/${initial.id}/continue`);
    reject(new TypeError("unknown commit"));
    await collecting;
    expect(session.getSnapshot().error).toBe(true);
    fetcher
      .mockResolvedValueOnce(json({ run: continued }))
      .mockResolvedValueOnce(json({ run: continued }));
    await session.retry();
    expect(fetcher.mock.calls[3][0]).toBe(original[0]);
    expect(fetcher.mock.calls[3][1]?.body).toBe(original[1]?.body);
    expect(session.getSnapshot()).toMatchObject({
      run: continued,
      error: false,
      loading: false,
    });
  });
  it("resynchronizes a lost reset reply without reapplying it against a newer version", async () => {
    const initial = runDto();
    const restored = { ...initial, version: initial.version + 1 };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ ready: true }))
      .mockResolvedValueOnce(json({ run: initial }));
    const session = setup(fetcher);
    await vi.waitFor(() => expect(session.getSnapshot().loading).toBe(false));
    fetcher.mockRejectedValueOnce(new TypeError("lost reset reply"));
    await session.resetLock();
    expect(session.getSnapshot().error).toBe(true);
    const original = fetcher.mock.calls[2];
    fetcher
      .mockResolvedValueOnce(json({ error: { code: "VERSION_CONFLICT" } }, 409))
      .mockResolvedValueOnce(json({ run: restored }));
    await session.retry();
    expect(fetcher.mock.calls[3][1]?.body).toBe(original[1]?.body);
    expect(fetcher.mock.calls[4][0]).toBe(`/api/runs/${initial.id}`);
    expect(session.getSnapshot()).toMatchObject({
      run: restored,
      error: false,
      loading: false,
    });
  });
  it("stops publishing and opening channels after disposal during bootstrap", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(
        new Promise<Response>((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce(json({ run: runDto() }));
    const session = setup(fetcher);
    const changed = vi.fn();
    session.subscribe(changed);
    session.close();
    resolve(json({ ready: true }));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(changed).not.toHaveBeenCalled();
    expect(session.getSnapshot().run).toBeNull();
  });
});
