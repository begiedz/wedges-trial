"use client";

import { useGameDictionary } from "@/i18n/provider";
import { DialogAction, GameDialog } from "./GameDialog";

export function RestartRunDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useGameDictionary().dialogs.restart;
  return (
    <GameDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      description={t.description}
      actions={<DialogAction onClick={onConfirm}>{t.confirm}</DialogAction>}
    >
      <DialogAction className="w-full" onClick={() => onOpenChange(false)}>
        {t.cancel}
      </DialogAction>
    </GameDialog>
  );
}
