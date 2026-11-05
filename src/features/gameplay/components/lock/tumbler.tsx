import { type CSSProperties, useEffect, useRef } from "react";

import type { Pin as LockPin } from "@/game/types";

import Pin from "./pin";

type TumblerProps = {
  pin: LockPin;
  isSelected?: boolean;
  onSelect?: (pinId: number) => void;
  invalidMoveSequence?: number;
};

const slotSizeRem = 1;
const slotGapRem = 0.25;
const slotStepRem = slotSizeRem + slotGapRem;
const shellPaddingXRem = 1;
const shellPaddingYRem = 0.5;

export default function Tumbler({
  pin,
  isSelected = false,
  onSelect,
  invalidMoveSequence = 0,
}: TumblerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (invalidMoveSequence === 0 || !buttonRef.current) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animation = buttonRef.current.animate(
      [0, -6, 6, -4, 4, 0].map((offset, index) => ({
        transform: `translateX(${reducedMotion ? 0 : offset}px)`,
        filter:
          index === 0 || index === 5
            ? "drop-shadow(0 0 0 transparent)"
            : "drop-shadow(0 0 5px var(--destructive))",
      })),
      { duration: 320, easing: "ease-out" },
    );

    return () => animation.cancel();
  }, [invalidMoveSequence]);

  const slotCount = pin.max - pin.min + 1;
  const slotSpan = Math.max(slotCount - 1, 0);
  const currentIndex = pin.position - pin.min;
  const isOnTarget = pin.position === pin.target;
  const viewportWidthRem = slotSizeRem + slotSpan * slotStepRem * 2;
  const trackOffsetRem = ((slotCount - 1) / 2 - currentIndex) * slotStepRem;

  const buttonStyle = {
    minHeight: `${slotSizeRem + shellPaddingYRem * 2}rem`,
    width: `${viewportWidthRem + shellPaddingXRem * 2}rem`,
  } satisfies CSSProperties;

  const trackStyle = {
    transform: `translate(-50%, -50%) translateX(${trackOffsetRem}rem)`,
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
      ref={buttonRef}
      aria-pressed={isSelected}
      onClick={onSelect ? () => onSelect(pin.id) : undefined}
      type="button"
      className="block relative"
      style={buttonStyle}
    >
      <span className="sr-only">{pin.id}</span>
      <div
        className="top-1/2 left-1/2 absolute transition-transform duration-300 ease-out"
        style={trackStyle}
      >
        <div
          className={[
            "inline-flex rounded-md px-20 py-1 transition-colors border-2 ",
            isSelected
              ? "bg-[#898c9e] border-gray-600"
              : "bg-[#AAA8A6] border-stone-600",
          ].join(" ")}
        >
          <div className="grid grid-flow-col" style={slotStyle}>
            {Array.from({ length: slotCount }, (_, index) => {
              const value = pin.min + index;

              return (
                <div
                  className="flex justify-center items-center bg-background shadow-[inset_0_1px_4px_rgba(0,0,0,0.45)] rounded-full"
                  key={value}
                  style={slotSizeStyle}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="z-10 absolute inset-0 flex justify-center items-center pointer-events-none">
        <Pin isOnTarget={isOnTarget} />
      </div>
    </button>
  );
}
