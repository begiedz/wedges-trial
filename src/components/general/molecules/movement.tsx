import Image from "next/image";
import AIcon from "@/assets/images/icons/T_Icon_PC_A.png";
import DIcon from "@/assets/images/icons/T_Icon_PC_D.png";
import NIcon from "@/assets/images/icons/T_Icon_PC_N.png";
import RIcon from "@/assets/images/icons/T_Icon_PC_R.png";
import WIcon from "@/assets/images/icons/T_Icon_PC_W.png";
import SIcon from "@/assets/images/icons/T_Icon_PS_S.png";

export default function Movement() {
  const iconSize = 32;

  return (
    <div className="flex flex-col items-center font-medium tracking-wider">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex">
            <Image
              src={AIcon.src}
              width={iconSize}
              height={iconSize}
              alt="Left"
            />
            <Image
              src={DIcon.src}
              width={iconSize}
              height={iconSize}
              alt="Right"
            />
          </div>
          <p>Move left/right</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex">
            <Image
              src={WIcon.src}
              width={iconSize}
              height={iconSize}
              alt="Up"
            />
            <Image
              src={SIcon.src}
              width={iconSize}
              height={iconSize}
              alt="Down"
            />
          </div>
          <p>Move up/down</p>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Image
              src={RIcon.src}
              width={iconSize}
              height={iconSize}
              alt="Reset"
            />
            <p>Reset</p>
          </div>
          <div className="flex items-center gap-2">
            <Image
              src={NIcon.src}
              width={iconSize}
              height={iconSize}
              alt="Next"
            />
            <p>Next</p>
          </div>
        </div>
      </div>
    </div>
  );
}
