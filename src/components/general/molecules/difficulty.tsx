import Image from "next/image";
import LockEmptyIcon from "@/assets/images/icons/T_LockDifficulty_Empty.png";
import LockFillIcon from "@/assets/images/icons/T_LockDifficulty_Fill.png";
import type { LockDifficulty } from "@/game/types";
import { useGameDictionary } from "@/i18n/provider";

interface DifficultyProps {
  level: LockDifficulty;
  size?: number;
}

export default function Difficulty({ level, size = 24 }: DifficultyProps) {
  const t = useGameDictionary();

  return (
    <div className="flex gap-1">
      <span className="text-secondary sm:text-lg">{t.labels.difficulty}:</span>
      <div className="flex justify-center items-center">
        {Array.from({ length: 4 }, (_, index) => {
          const isFilled = index < level;

          const icon = isFilled ? LockFillIcon : LockEmptyIcon;

          return (
            <Image
              // biome-ignore lint/suspicious/noArrayIndexKey: static array
              key={index}
              src={icon.src}
              alt=""
              width={size}
              height={size}
            />
          );
        })}
      </div>
    </div>
  );
}
