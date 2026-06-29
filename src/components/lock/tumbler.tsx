import type { CSSProperties } from "react";

import type { Pin as LockPin } from "@/game/types";

import Pin from "./pin";

type TumblerProps = {
  pin: LockPin;
  isSelected?: boolean;
  onSelect?: (pinId: number) => void;
};

const trackVariables = {
  "--slot-gap": "0.75rem",
  "--slot-size": "2rem",
} as CSSProperties;

export default function Tumbler({
  pin,
  isSelected = false,
  onSelect,
}: TumblerProps) {
  const slotCount = pin.max - pin.min + 1;
  const currentIndex = pin.position - pin.min;
  const targetIndex = pin.target - pin.min;
  const isOnTarget = pin.position === pin.target;
  const pinStyle = {
    transform: `translateX(calc(${currentIndex} * (var(--slot-size) + var(--slot-gap))))`,
  } satisfies CSSProperties;

  return (
    <button
      className={[
        "w-fit rounded-sm border px-4 py-3 text-left transition-colors",
        isSelected
          ? "border-[#f9ddd0] bg-[#3b363b]"
          : "border-[#6d6a68] bg-[#AAA8A6]",
      ].join(" ")}
      onClick={() => onSelect?.(pin.id)}
      type="button"
    >
      <div className="mb-2 flex items-center justify-between gap-4 text-xs text-background">
        <span className="font-semibold">#{pin.id}</span>
        <span className="font-mono">
          {pin.position}/{pin.target}
        </span>
      </div>
      <div className="relative" style={trackVariables}>
        <div className="grid grid-flow-col gap-[var(--slot-gap)]">
          {Array.from({ length: slotCount }, (_, index) => {
            const value = pin.min + index;
            const isTargetSlot = index === targetIndex;

            return (
              <div
                className={[
                  "flex size-[var(--slot-size)] items-center justify-center rounded-full bg-background shadow-[inset_0_1px_4px_rgba(0,0,0,0.45)]",
                  isTargetSlot
                    ? isSelected
                      ? "ring-2 ring-[#5f7a43]/80 ring-offset-2 ring-offset-[#3b363b]"
                      : "ring-2 ring-[#5f7a43]/80 ring-offset-2 ring-offset-[#AAA8A6]"
                    : "",
                ].join(" ")}
                key={value}
              >
                <span className="font-mono text-[10px] text-[#a9a9a9]">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center transition-transform duration-300 ease-out"
          style={pinStyle}
        >
          <Pin isOnTarget={isOnTarget} isSelected={isSelected} />
        </div>
      </div>
    </button>
  );
}
