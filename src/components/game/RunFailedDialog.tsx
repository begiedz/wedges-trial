"use client";

import type { RunResultDto } from "@/api/contracts";
import { useGameDictionary } from "@/i18n/provider";
import { DialogAction, GameDialog } from "./GameDialog";

export function RunFailedDialog({
  open,
  result,
  onNewRun,
}: {
  open: boolean;
  result: RunResultDto | null;
  onNewRun: () => void;
}) {
  const t = useGameDictionary();
  return (
    <GameDialog
      open={open}
      title={t.dialogs.failed.title}
      description={t.dialogs.failed.description}
      actions={
        <DialogAction onClick={onNewRun}>{t.actions.newRun}</DialogAction>
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
  );
}
