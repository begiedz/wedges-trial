"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunDto } from "@/api/contracts";
import type { Direction } from "@/game/types";

type Reply = { run: RunDto | null; outcome?: string };
type Pending = { path: string; body: Record<string, unknown> };
class RequestError extends Error {
  constructor(public status: number) {
    super("REQUEST_FAILED");
  }
}
async function request(
  path: string,
  body?: Record<string, unknown>,
): Promise<Reply> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok) throw new RequestError(response.status);
  const result = await response.json();
  if (path === "/api/players/session") return { run: null };
  if (
    !result ||
    !("run" in result) ||
    (result.run !== null &&
      (!Number.isSafeInteger(result.run.version) ||
        typeof result.run.id !== "string" ||
        !Array.isArray(result.run.currentLock?.pins)))
  )
    throw new TypeError("INVALID_RESPONSE");
  return result;
}
export function useGameSession() {
  const [run, setRun] = useState<RunDto | null>(null);
  const current = useRef<RunDto | null>(null);
  const busy = useRef(false);
  const pending = useRef<Pending | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const restarting = useRef(false);
  const publish = useCallback((next: RunDto | null) => {
    if (
      next &&
      current.current?.id === next.id &&
      current.current.version > next.version
    )
      return;
    current.current = next;
    setRun(next);
    setRewardOpen(next?.status === "chest_opened");
  }, []);
  const submit = useCallback(
    async (command: Pending): Promise<Reply> => {
      pending.current = command;
      const result = await request(command.path, command.body);
      pending.current = null;
      publish(result.run);
      return result;
    },
    [publish],
  );
  const restore = useCallback(async () => {
    const result = await request("/api/runs/current");
    if (result.run) {
      publish(result.run);
      return;
    }
    // Preserve a finished run across refresh without browser gameplay storage.
    const id = new URL(window.location.href).searchParams.get("run");
    if (id && !restarting.current) {
      try {
        const terminal = await request(`/api/runs/${encodeURIComponent(id)}`);
        publish(terminal.run);
        return;
      } catch (e) {
        if (!(e instanceof RequestError) || e.status !== 404) throw e;
      }
    }
    await submit({
      path: "/api/runs",
      body: { actionId: crypto.randomUUID() },
    });
  }, [publish, submit]);
  const recover = useCallback(
    async (failure: unknown) => {
      if (
        failure instanceof RequestError &&
        failure.status >= 400 &&
        failure.status < 500 &&
        failure.status !== 429
      ) {
        pending.current = null;
        if (failure.status === 409 || failure.status === 404) {
          const id = current.current?.id;
          if (id) publish((await request(`/api/runs/${id}`)).run);
          else await restore();
          return;
        }
      }
      throw failure;
    },
    [publish, restore],
  );
  const exclusive = useCallback(
    async <T>(work: () => Promise<T>) => {
      if (busy.current) return null;
      busy.current = true;
      setLoading(true);
      setError(false);
      try {
        return await work();
      } catch (failure) {
        try {
          await recover(failure);
        } catch {
          setError(true);
        }
        return null;
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [recover],
  );
  const restart = useCallback(async () => {
    restarting.current = true;
    const active = current.current;
    if (
      active &&
      (active.status === "playing" || active.status === "chest_opened")
    ) {
      await submit({
        path: `/api/runs/${active.id}/abandon`,
        body: {
          actionId: crypto.randomUUID(),
          expectedVersion: active.version,
        },
      });
    }
    await submit({
      path: "/api/runs",
      body: { actionId: crypto.randomUUID() },
    });
    restarting.current = false;
    setRestartOpen(false);
  }, [submit]);
  const retry = useCallback(
    () =>
      exclusive(async () => {
        if (pending.current) {
          const command = pending.current;
          await submit(command);
          if (restarting.current && command.path === "/api/runs") {
            restarting.current = false;
            setRestartOpen(false);
            return;
          }
        }
        if (restarting.current) {
          await restart();
          return;
        }
        if (!current.current) {
          await request("/api/players/session", {});
          await restore();
        } else publish((await request(`/api/runs/${current.current.id}`)).run);
      }),
    [exclusive, publish, restore, restart, submit],
  );
  useEffect(() => {
    void exclusive(async () => {
      await request("/api/players/session", {});
      await restore();
    });
  }, [exclusive, restore]);
  useEffect(() => {
    if (!run) return;
    const url = new URL(window.location.href);
    url.searchParams.set("run", run.id);
    window.history.replaceState(null, "", url);
  }, [run]);
  const action = useCallback(
    (name: string, extra: Record<string, unknown> = {}) =>
      exclusive(async () => {
        const active = current.current;
        if (!active || pending.current || error) return;
        return submit({
          path: `/api/runs/${active.id}/${name}`,
          body: {
            actionId: crypto.randomUUID(),
            expectedVersion: active.version,
            ...extra,
          },
        });
      }),
    [error, exclusive, submit],
  );
  const move = useCallback(
    (pinId: number, direction: Direction) =>
      action("move", { pinId, direction }),
    [action],
  );
  const resetLock = useCallback(() => action("reset"), [action]);
  const continueToNextChest = useCallback(() => action("continue"), [action]);
  const startNewRun = useCallback(() => {
    if (pending.current || error) return;
    void exclusive(restart);
  }, [error, exclusive, restart]);
  const requestNewRun = useCallback(() => {
    if (busy.current || error) return;
    if (current.current?.status === "finished") startNewRun();
    else setRestartOpen(true);
  }, [error, startNewRun]);
  return {
    run,
    reward: run?.reward ?? null,
    rewardOpen,
    setRewardOpen,
    restartOpen,
    setRestartOpen,
    move,
    continueToNextChest,
    resetLock,
    startNewRun,
    requestNewRun,
    loading,
    error,
    retry,
  };
}
