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

export default function Tumbler({ pin, isSelected = false }: TumblerProps) {
  const slotCount = pin.max - pin.min + 1;
  const currentIndex = pin.position - pin.min;
  const isOnTarget = pin.position === pin.target;
  const pinStyle = {
    transform: `translateX(calc(${currentIndex} * (var(--slot-size) + var(--slot-gap))))`,
  };

  return (
    <div
      className={[
        "w-fit rounded-sm  px-10 py-3 text-left transition-colors",
        isSelected ? "bg-[#898c9e]" : "bg-[#AAA8A6]",
      ].join(" ")}
    >
      <div className="relative" style={trackVariables}>
        <div className="gap-(--slot-gap) grid grid-flow-col">
          {Array.from({ length: slotCount }, (_, index) => {
            const value = pin.min + index;

            return (
              //pin-hole
              <div
                className="flex justify-center items-center bg-background shadow-[inset_0_1px_4px_rgba(0,0,0,0.45)] rounded-full size-7"
                key={value}
              />
            );
          })}
        </div>
        <div
          className="left-0 absolute inset-y-0 flex items-center transition-transform duration-300 ease-out pointer-events-none"
          style={pinStyle}
        >
          <Pin isOnTarget={isOnTarget} />
        </div>
      </div>
    </div>
  );
}
