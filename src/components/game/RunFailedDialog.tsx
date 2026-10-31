"use client";

import { useGameDictionary } from "@/i18n/provider";
import { DialogAction, GameDialog } from "./GameDialog";

export function RunFailedDialog({
  open,
  oreNuggets,
  openedChests,
  onNewRun,
}: {
  open: boolean;
  oreNuggets: number;
  openedChests: number;
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
            {oreNuggets}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t.dialogs.failed.openedChests}
          </dt>
          <dd className="mt-4 font-heading text-5xl tabular-nums">
            {openedChests}
          </dd>
        </div>
      </dl>
    </GameDialog>
  );
}
