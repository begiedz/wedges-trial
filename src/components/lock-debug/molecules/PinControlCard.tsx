import type { Pin } from "@/game/types";

import type { TextLockCopy } from "../types";
import { joinClasses } from "../utils";

type PinControlCardProps = {
  copy: TextLockCopy;
  isDisabled: boolean;
  isSelected: boolean;
  onMove: (pinId: number, direction: -1 | 1) => void;
  onSelect: (pinId: number) => void;
  pin: Pin;
};

export function PinControlCard({
  copy,
  isDisabled,
  isSelected,
  onMove,
  onSelect,
  pin,
}: PinControlCardProps) {
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
            {copy.labels.position}: {pin.position}
          </p>
          <p className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {copy.labels.target}: {pin.target}
          </p>
        </div>
        <button
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500"
          onClick={() => onSelect(pin.id)}
          type="button"
        >
          {copy.actions.selectPin}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {copy.labels.range}: {pin.min}..{pin.max}
        {isOnTarget ? ` · ${copy.labels.onTarget}` : ""}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500"
          disabled={isDisabled}
          onClick={() => onMove(pin.id, -1)}
          type="button"
        >
          {copy.actions.moveLeft}
        </button>
        <button
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500"
          disabled={isDisabled}
          onClick={() => onMove(pin.id, 1)}
          type="button"
        >
          {copy.actions.moveRight}
        </button>
      </div>
    </div>
  );
}
