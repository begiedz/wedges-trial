"use client";

import LockPickIcon from "@/assets/images/icons/items/T_ItemIcon_ItKe_Lockpick.png";
import OreNuggetIcon from "@/assets/images/icons/items/T_ItemIcon_ItMi_Orenugget.png";
import ItemFrame from "@/components/general/molecules/item-frame";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChestReward } from "@/game/types";
import { useGameDictionary } from "@/i18n/provider";
import { DialogAction } from "./GameDialog";

type ChestRewardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: ChestReward;
  totalOre: number;
  onContinue: () => void;
};

export function ChestRewardDialog({
  open,
  onOpenChange,
  reward,
  totalOre,
  onContinue,
}: ChestRewardDialogProps) {
  const t = useGameDictionary();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[min(32rem,calc(100dvh-2rem))] max-w-sm"
        onInteractOutside={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.code === "Space" || event.key === " ") {
            event.preventDefault();
            if (!event.repeat) onContinue();
          }
        }}
      >
        <header className="shrink-0 px-4 py-4 text-center sm:py-5">
          <DialogTitle className="font-heading text-3xl uppercase sm:text-4xl">
            {t.dialogs.reward.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t.dialogs.reward.description}
          </DialogDescription>
        </header>

        <div className="min-h-32 flex-1 overflow-y-auto border-y border-border bg-background-secondary px-6 py-4">
          <ul className="grid grid-cols-3 gap-3">
            <li>
              <ItemFrame
                className="border-foreground/50 bg-background-secondary [&_img]:h-full [&_img]:w-full [&_img]:translate-y-0 [&_img]:object-contain"
                item={OreNuggetIcon.src}
                amount={reward.oreNuggets}
                width={128}
                height={128}
                alt={t.labels.oreNuggets}
              />
            </li>
            {reward.lockpicks > 0 && (
              <li>
                <ItemFrame
                  className="border-foreground/50 bg-background-secondary [&_img]:h-full [&_img]:w-full [&_img]:translate-y-0 [&_img]:object-contain"
                  item={LockPickIcon.src}
                  amount={reward.lockpicks}
                  width={128}
                  height={128}
                  alt={t.labels.lockpick}
                />
              </li>
            )}
          </ul>
        </div>

        <footer className="shrink-0 px-4 pb-4">
          <p className="py-3 text-right text-lg tabular-nums">
            <span className="sr-only">{t.dialogs.reward.totalOre}: </span>
            {totalOre}
          </p>
          <div className="flex flex-wrap gap-3">
            <DialogAction aria-keyshortcuts="Space" onClick={onContinue}>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center border border-foreground/60 bg-background-secondary"
              >
                {/* Replace this placeholder with the supplied spacebar icon. */}
                <svg
                  aria-hidden="true"
                  data-slot="spacebar-icon"
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="currentColor"
                >
                  <path d="M3 9h3v6h12V9h3v9H3z" />
                </svg>
              </span>
              {t.dialogs.reward.takeAll}
            </DialogAction>
            <DialogAction onClick={() => onOpenChange(false)}>
              <span
                aria-hidden="true"
                className="border border-foreground/60 px-2 py-1 text-xs"
              >
                {t.dialogs.closeKey}
              </span>
              {t.dialogs.close}
            </DialogAction>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
