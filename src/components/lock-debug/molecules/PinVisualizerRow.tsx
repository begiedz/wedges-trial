import type { Pin } from "@/game/types";

import type { TextLockCopy } from "../types";
import { joinClasses } from "../utils";

type PinVisualizerRowProps = {
  copy: TextLockCopy;
  isSelected: boolean;
  pin: Pin;
  onSelect: (pinId: number) => void;
};

export function PinVisualizerRow({
  copy,
  isSelected,
  pin,
  onSelect,
}: PinVisualizerRowProps) {
  const isOnTarget = pin.position === pin.target;
  const range = pin.max - pin.min;
  const positionPercent =
    range > 0 ? ((pin.position - pin.min) / range) * 100 : 0;
  const targetPercent = range > 0 ? ((pin.target - pin.min) / range) * 100 : 0;

  return (
    <button
      className={joinClasses(
        "grid w-full gap-3 rounded-xl border px-4 py-3 text-left transition sm:grid-cols-[72px_1fr_auto] sm:items-center",
        isSelected
          ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
      )}
      onClick={() => onSelect(pin.id)}
      type="button"
    >
      <div>
        <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
          #{pin.id}
        </p>
        <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {pin.min}..{pin.max}
        </p>
      </div>
      <div className="space-y-2">
        <div className="relative h-8 rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
          <span
            className={joinClasses(
              "absolute bottom-0 left-0 top-0 rounded-full transition-all",
              isOnTarget ? "bg-emerald-500" : "bg-amber-500 dark:bg-amber-400",
            )}
            style={{ width: `${Math.max(positionPercent, 0)}%` }}
          />
          <span
            className="absolute bottom-[-5px] top-[-5px] w-0 border-l-2 border-dashed border-emerald-500"
            style={{ left: `${targetPercent}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{pin.min}</span>
          <span>{pin.max}</span>
        </div>
      </div>
      <div className="font-mono text-xs text-zinc-600 dark:text-zinc-300 sm:text-right">
        <p>
          {copy.labels.position}: {pin.position}
        </p>
        <p>
          {copy.labels.target}: {pin.target}
        </p>
      </div>
    </button>
  );
}
