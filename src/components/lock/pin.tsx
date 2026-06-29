import type { ReactNode } from "react";

type PinProps = {
  isOnTarget?: boolean;
  isSelected?: boolean;
};

function PinHole({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-8 items-center justify-center rounded-full bg-background shadow-[inset_0_1px_4px_rgba(0,0,0,0.45)]">
      {children}
    </div>
  );
}

export default function Pin({
  isOnTarget = false,
  isSelected = false,
}: PinProps) {
  return (
    <PinHole>
      <div
        className={[
          "size-5 rounded-full border transition-colors duration-300",
          isOnTarget
            ? "border-[#8ea56e] bg-[#5f7a43]"
            : "border-[#c0af8d] bg-[#94876F]",
          isSelected ? "shadow-[0_0_0_2px_rgba(249,221,208,0.28)]" : "",
        ].join(" ")}
      />
    </PinHole>
  );
}
