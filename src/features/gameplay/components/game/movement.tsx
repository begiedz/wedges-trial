import Image from "next/image";
import Link from "next/link";
import AIcon from "@/assets/images/icons/T_Icon_PC_A.png";
import DIcon from "@/assets/images/icons/T_Icon_PC_D.png";
import EscapeIcon from "@/assets/images/icons/T_Icon_PC_Escape.png";
import RIcon from "@/assets/images/icons/T_Icon_PC_R.png";
import WIcon from "@/assets/images/icons/T_Icon_PC_W.png";
import SIcon from "@/assets/images/icons/T_Icon_PS_S.png";
import { Button } from "@/components/ui/button";
import { useGameDictionary, useLocale } from "@/i18n/provider";

type MovementProps = {
  disabled?: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onReset: () => void;
  onSelectNextPin: () => void;
  onSelectPreviousPin: () => void;
};

type MovementButtonProps = {
  disabled?: boolean;
  alt: string;
  iconSize: number;
  onClick: () => void;
  src: string;
};

function MovementButton({
  alt,
  iconSize,
  onClick,
  src,
  disabled,
}: MovementButtonProps) {
  return (
    <Button
      variant="unstyled"
      size="bare"
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={alt}
      className="bg-transparent border-0 appearance-none"
    >
      <Image
        src={src}
        width={iconSize}
        height={iconSize}
        alt={alt}
        className="sm:size-8"
      />
    </Button>
  );
}

export default function Movement({
  disabled = false,
  onMoveLeft,
  onMoveRight,
  onReset,
  onSelectNextPin,
  onSelectPreviousPin,
}: MovementProps) {
  const dictionary = useGameDictionary();
  const t = dictionary.movement;
  const locale = useLocale();
  const iconSize = 64;

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex">
            <MovementButton
              disabled={disabled}
              src={AIcon.src}
              iconSize={iconSize}
              alt={t.actions.moveLeft}
              onClick={onMoveLeft}
            />
            <MovementButton
              disabled={disabled}
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
              disabled={disabled}
              src={WIcon.src}
              iconSize={iconSize}
              alt={t.actions.selectPreviousPin}
              onClick={onSelectPreviousPin}
            />
            <MovementButton
              disabled={disabled}
              src={SIcon.src}
              iconSize={iconSize}
              alt={t.actions.selectNextPin}
              onClick={onSelectNextPin}
            />
          </div>
          <p>{t.labels.moveVertical}</p>
        </div>

        <div className="flex flex-wrap items-center gap-8">
          <Button asChild variant="unstyled" size="bare" className="gap-2">
            <Link
              href={`/${locale}`}
              aria-label={dictionary.actions.exitGame}
              aria-keyshortcuts="Escape"
            >
              <Image
                src={EscapeIcon}
                width={64}
                height={64}
                alt=""
                className="size-16 shrink-0 object-contain sm:size-8"
              />
              <span>{dictionary.actions.exitGame}</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <MovementButton
              disabled={disabled}
              src={RIcon.src}
              iconSize={iconSize}
              alt={t.actions.reset}
              onClick={onReset}
            />
            <p>{t.labels.reset}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
