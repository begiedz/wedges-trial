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
