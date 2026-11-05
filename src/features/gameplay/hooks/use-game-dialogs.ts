"use client";

import { useEffect, useState } from "react";
import type { RunDto } from "@/api/contracts";

/** Dialogs follow confirmed status; predicted pin positions cannot open them. */
export function useGameDialogs(run: RunDto | null) {
  const [rewardOpen, setRewardOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const runId = run?.id;
  const status = run?.status;
  useEffect(() => {
    setRewardOpen(!!runId && status === "chest_opened");
  }, [runId, status]);
  useEffect(() => {
    if (runId) setRestartOpen(false);
  }, [runId]);
  return { rewardOpen, setRewardOpen, restartOpen, setRestartOpen };
}
