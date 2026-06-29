import type { CSSProperties } from "react";

import type { Pin as LockPin } from "@/game/types";

import Pin from "./pin";

type TumblerProps = {
  pin: LockPin;
  isSelected?: boolean;
  onSelect?: (pinId: number) => void;
};

const slotSizeRem = 1.25;
const slotGapRem = 0.375;
const slotStepRem = slotSizeRem + slotGapRem;

export default function Tumbler({
  pin,
  isSelected = false,
  onSelect,
}: TumblerProps) {
  const slotCount = pin.max - pin.min + 1;
  const slotSpan = Math.max(slotCount - 1, 0);
  const currentIndex = pin.position - pin.min;
  const isOnTarget = pin.position === pin.target;
  const trackWidthRem = slotCount * slotSizeRem + slotSpan * slotGapRem;
  const viewportWidthRem = slotSizeRem + slotSpan * slotStepRem * 2;
  const trackOffsetRem = ((slotCount - 1) / 2 - currentIndex) * slotStepRem;
  const viewportStyle = {
    minHeight: `${slotSizeRem}rem`,
    width: `${viewportWidthRem}rem`,
  } satisfies CSSProperties;
  const trackStyle = {
    transform: `translate(-50%, -50%) translateX(${trackOffsetRem}rem)`,
    width: `${trackWidthRem}rem`,
  } satisfies CSSProperties;
  const slotStyle = {
    gap: `${slotGapRem}rem`,
  } satisfies CSSProperties;
  const slotSizeStyle = {
    height: `${slotSizeRem}rem`,
    width: `${slotSizeRem}rem`,
  } satisfies CSSProperties;

  return (
    <button
      aria-pressed={isSelected}
      onClick={onSelect ? () => onSelect(pin.id) : undefined}
      type="button"
      className={[
        "block w-fit rounded-sm px-4 py-3 text-left transition-colors",
        isSelected ? "bg-[#898c9e]" : "bg-[#AAA8A6]",
      ].join(" ")}
    >
      <span className="sr-only">{pin.id}</span>
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={viewportStyle}
      >
        <div
          className="absolute top-1/2 left-1/2 transition-transform duration-300 ease-out"
          style={trackStyle}
        >
          <div className="grid grid-flow-col" style={slotStyle}>
            {Array.from({ length: slotCount }, (_, index) => {
              const value = pin.min + index;

              return (
                <div
                  className="flex items-center justify-center rounded-full bg-background shadow-[inset_0_1px_4px_rgba(0,0,0,0.45)]"
                  key={value}
                  style={slotSizeStyle}
                />
              );
            })}
          </div>
        </div>
        <div className="pointer-events-none relative z-10 flex items-center justify-center">
          <Pin isOnTarget={isOnTarget} />
        </div>
      </div>
    </button>
  );
}
