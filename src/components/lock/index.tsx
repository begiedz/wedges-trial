import type { Pin } from "@/game/types";

import Tumbler from "./tumbler";

type LockProps = {
  pins: Pin[];
  selectedPinId?: number | null;
  onSelectPin?: (pinId: number) => void;
};

export default function Lock({
  pins,
  selectedPinId = null,
  onSelectPin,
}: LockProps) {
  return (
    <div className="flex w-full flex-col items-center gap-3 overflow-x-auto pb-2">
      {pins.map((pin) => (
        <Tumbler
          isSelected={pin.id === selectedPinId}
          key={pin.id}
          onSelect={onSelectPin}
          pin={pin}
        />
      ))}
    </div>
  );
}
