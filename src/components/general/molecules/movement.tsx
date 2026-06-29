import Image from "next/image";
import { textLockCopy } from "@/app/textLockCopy";
import AIcon from "@/assets/images/icons/T_Icon_PC_A.png";
import DIcon from "@/assets/images/icons/T_Icon_PC_D.png";
import NIcon from "@/assets/images/icons/T_Icon_PC_N.png";
import RIcon from "@/assets/images/icons/T_Icon_PC_R.png";
import WIcon from "@/assets/images/icons/T_Icon_PC_W.png";
import SIcon from "@/assets/images/icons/T_Icon_PS_S.png";

type MovementProps = {
  onContinueToNextChest: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onReset: () => void;
  onSelectNextPin: () => void;
  onSelectPreviousPin: () => void;
};

type MovementButtonProps = {
  alt: string;
  iconSize: number;
  onClick: () => void;
  src: string;
};

function MovementButton({ alt, iconSize, onClick, src }: MovementButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={alt}
      className="bg-transparent p-0 border-0 appearance-none cursor-pointer"
    >
      <Image src={src} width={iconSize} height={iconSize} alt={alt} />
    </button>
  );
}

export default function Movement({
  onContinueToNextChest,
  onMoveLeft,
  onMoveRight,
  onReset,
  onSelectNextPin,
  onSelectPreviousPin,
}: MovementProps) {
  const iconSize = 32;

  return (
    <div className="flex flex-col items-center tracking-wide">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex">
            <MovementButton
              src={AIcon.src}
              iconSize={iconSize}
              alt={textLockCopy.actions.moveLeft}
              onClick={onMoveLeft}
            />
            <MovementButton
              src={DIcon.src}
              iconSize={iconSize}
              alt={textLockCopy.actions.moveRight}
              onClick={onMoveRight}
            />
          </div>
          <p>{textLockCopy.labels.moveHorizontal}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex">
            <MovementButton
              src={WIcon.src}
              iconSize={iconSize}
              alt={textLockCopy.actions.selectPreviousPin}
              onClick={onSelectPreviousPin}
            />
            <MovementButton
              src={SIcon.src}
              iconSize={iconSize}
              alt={textLockCopy.actions.selectNextPin}
              onClick={onSelectNextPin}
            />
          </div>
          <p>{textLockCopy.labels.moveVertical}</p>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <MovementButton
              src={RIcon.src}
              iconSize={iconSize}
              alt={textLockCopy.actions.reset}
              onClick={onReset}
            />
            <p>{textLockCopy.labels.reset}</p>
          </div>
          <div className="flex items-center gap-2">
            <MovementButton
              src={NIcon.src}
              iconSize={iconSize}
              alt={textLockCopy.actions.continueToNextChest}
              onClick={onContinueToNextChest}
            />
            <p>{textLockCopy.labels.next}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
