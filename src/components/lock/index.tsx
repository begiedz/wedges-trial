import type { Pin } from "@/game/types";

import Tumbler from "./tumbler";

type LockProps = {
  pins: Pin[];
  selectedPinId?: number | null;
  onSelectPin?: (pinId: number) => void;
  invalidMove?: { pinId: number; sequence: number };
};

export default function Lock({
  pins,
  selectedPinId = null,
  onSelectPin,
  invalidMove,
}: LockProps) {
  return (
    <div className="flex flex-col items-center w-full overflow-x-auto">
      {pins.map((pin) => (
        <Tumbler
          invalidMoveSequence={
            invalidMove?.pinId === pin.id ? invalidMove.sequence : 0
          }
          isSelected={pin.id === selectedPinId}
          key={pin.id}
          onSelect={onSelectPin}
          pin={pin}
        />
      ))}
    </div>
  );
}
