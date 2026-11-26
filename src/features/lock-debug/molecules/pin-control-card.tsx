import { Button } from "@/components/ui/button";
import type { Pin } from "@/game/types";
import { useDebugDictionary } from "@/i18n/provider";
import { joinClasses } from "../utils";

type PinControlCardProps = {
  isDisabled: boolean;
  isSelected: boolean;
  onMove: (pinId: number, direction: -1 | 1) => void;
  onSelect: (pinId: number) => void;
  pin: Pin;
};

export function PinControlCard({
  isDisabled,
  isSelected,
  onMove,
  onSelect,
  pin,
}: PinControlCardProps) {
  const t = useDebugDictionary();
  const isOnTarget = pin.position === pin.target;

  return (
    <div
      className={joinClasses(
        "rounded-xl border p-4 transition",
        isSelected
          ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
            #{pin.id}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {t.labels.position}: {pin.position}
          </p>
          <p className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {t.labels.target}: {pin.target}
          </p>
        </div>
        <Button size="sm" onClick={() => onSelect(pin.id)} type="button">
          {t.actions.selectPin}
        </Button>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {t.labels.range}: {pin.min}..{pin.max}
        {isOnTarget ? ` · ${t.labels.onTarget}` : ""}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          disabled={isDisabled}
          onClick={() => onMove(pin.id, -1)}
          type="button"
        >
          {t.actions.moveLeft}
        </Button>
        <Button
          size="sm"
          disabled={isDisabled}
          onClick={() => onMove(pin.id, 1)}
          type="button"
        >
          {t.actions.moveRight}
        </Button>
      </div>
    </div>
  );
}
