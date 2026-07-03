import Image from "next/image";
import AIcon from "@/assets/images/icons/T_Icon_PC_A.png";
import DIcon from "@/assets/images/icons/T_Icon_PC_D.png";
import NIcon from "@/assets/images/icons/T_Icon_PC_N.png";
import RIcon from "@/assets/images/icons/T_Icon_PC_R.png";
import WIcon from "@/assets/images/icons/T_Icon_PC_W.png";
import SIcon from "@/assets/images/icons/T_Icon_PS_S.png";
import { useGameDictionary } from "@/i18n/provider";

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
      <Image
        src={src}
        width={iconSize}
        height={iconSize}
        alt={alt}
        className="sm:size-8"
      />
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
  const t = useGameDictionary().movement;
  const iconSize = 64;

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex">
            <MovementButton
              src={AIcon.src}
              iconSize={iconSize}
              alt={t.actions.moveLeft}
              onClick={onMoveLeft}
            />
            <MovementButton
              src={DIcon.src}
              iconSize={iconSize}
              alt={t.actions.moveRight}
              onClick={onMoveRight}
            />
          </div>
          <p>{t.labels.moveHorizontal}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex">
            <MovementButton
              src={WIcon.src}
              iconSize={iconSize}
              alt={t.actions.selectPreviousPin}
              onClick={onSelectPreviousPin}
            />
            <MovementButton
              src={SIcon.src}
              iconSize={iconSize}
              alt={t.actions.selectNextPin}
              onClick={onSelectNextPin}
            />
          </div>
          <p>{t.labels.moveVertical}</p>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <MovementButton
              src={RIcon.src}
              iconSize={iconSize}
              alt={t.actions.reset}
              onClick={onReset}
            />
            <p>{t.labels.reset}</p>
          </div>
          <div className="flex items-center gap-2">
            <MovementButton
              src={NIcon.src}
              iconSize={iconSize}
              alt={t.actions.continueToNextChest}
              onClick={onContinueToNextChest}
            />
            <p>{t.labels.next}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
