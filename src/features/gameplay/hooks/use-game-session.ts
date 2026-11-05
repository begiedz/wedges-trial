"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { GameApiClient } from "@/client/game/api";
import { GameSession } from "@/client/game/session";
import { useGameDialogs } from "./use-game-dialogs";

/** React adapter: application state lives in GameSession; URL/dialogs are presentation. */
export function useGameSession() {
  const [session] = useState(
    () =>
      new GameSession(new GameApiClient(), {
        restoredRunId: () =>
          new URL(window.location.href).searchParams.get("run"),
      }),
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const dialogs = useGameDialogs(state.run);
  useEffect(() => {
    session.start();
    return session.close;
  }, [session]);
  const id = state.run?.id;
  useEffect(() => {
    if (!id) return;
    const url = new URL(window.location.href);
    url.searchParams.set("run", id);
    window.history.replaceState(null, "", url);
  }, [id]);
  const { setRestartOpen } = dialogs;
  const requestNewRun = useCallback(() => {
    if (!session.canRequestNewRun) return;
    if (session.getSnapshot().run?.status === "finished")
      void session.startNewRun();
    else setRestartOpen(true);
  }, [session, setRestartOpen]);
  return {
    ...state,
    ...dialogs,
    reward: state.run?.reward ?? null,
    move: session.move,
    resetLock: session.resetLock,
    continueToNextChest: session.continueToNextChest,
    startNewRun: session.startNewRun,
    requestNewRun,
    retry: session.retry,
  };
}
