import Image from "next/image";
import gothicLogo from "@/assets/images/logo.png";
import { useDictionary } from "@/i18n/provider";

export default function Logo() {
  const t = useDictionary();

  return (
    <div className="flex flex-col items-center gap-1">
      <Image
        src={gothicLogo.src}
        alt={t.common.brand.logoAlt}
        width={360}
        height={150}
        className="drop-shadow-black drop-shadow-md w-10"
      />
      <h1 className="text-shadow-black text-shadow-md font-heading text-xl">
        {t.common.brand.name}
      </h1>
    </div>
  );
}
