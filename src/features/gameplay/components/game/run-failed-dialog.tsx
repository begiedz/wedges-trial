"use client";

import { useState } from "react";
import type { RunResultDto } from "@/api/contracts";
import { useGameDictionary } from "@/i18n/provider";
import { ExitGameLink } from "./exit-game-link";
import { DialogAction, GameDialog } from "./game-dialog";
import { LeaderboardClaim } from "./leaderboard-claim";

export function RunFailedDialog({
  open,
  result,
  runId,
  onNewRun,
}: {
  open: boolean;
  result: RunResultDto | null;
  runId?: string;
  onNewRun: () => void;
}) {
  const t = useGameDictionary();
  const [claimOpen, setClaimOpen] = useState(false);
  return (
    <>
      <GameDialog
        open={open && !claimOpen}
        title={t.dialogs.failed.title}
        description={t.dialogs.failed.description}
        actions={
          <>
            {runId && (
              <DialogAction onClick={() => setClaimOpen(true)}>
                {t.dialogs.failed.leaderboard}
              </DialogAction>
            )}
            <DialogAction onClick={onNewRun}>{t.actions.newRun}</DialogAction>
            <ExitGameLink />
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-6 text-center">
          <div>
            <dt className="text-sm text-muted-foreground">
              {t.labels.oreNuggets}
            </dt>
            <dd className="mt-4 font-heading text-5xl tabular-nums">
              {result?.oreNuggets}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {t.dialogs.failed.openedChests}
            </dt>
            <dd className="mt-4 font-heading text-5xl tabular-nums">
              {result?.openedChests}
            </dd>
          </div>
          {(["moves", "invalidMoves", "brokenPicks"] as const).map((metric) => (
            <div
              key={metric}
              className={metric === "moves" ? "col-span-2" : undefined}
            >
              <dt className="text-sm text-muted-foreground">
                {t.dialogs.failed[metric]}
              </dt>
              <dd className="mt-2 font-heading text-3xl tabular-nums">
                {result?.totalMetrics?.[metric] ?? t.dialogs.failed.unavailable}
              </dd>
            </div>
          ))}
        </dl>
      </GameDialog>
      {runId && claimOpen && (
        <GameDialog
          open={open}
          title={t.leaderboardClaim.title}
          description={t.leaderboardClaim.description}
          actions={
            <>
              <DialogAction onClick={onNewRun}>{t.actions.newRun}</DialogAction>
              <ExitGameLink />
            </>
          }
        >
          <LeaderboardClaim key={runId} runId={runId} />
        </GameDialog>
      )}
    </>
  );
}
