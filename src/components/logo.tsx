import Image from "next/image";
import gothicLogo from "@/assets/images/logo.png";

export default function Logo() {
  return (
    <div className="flex flex-col items-center gap-1">
      <Image
        src={gothicLogo.src}
        alt="Gothic Remake"
        width={360}
        height={150}
        className="drop-shadow-black drop-shadow-md w-20"
      />
      <h1 className="text-shadow-black text-shadow-md font-heading text-primary text-3xl">
        Wedge's Trial
      </h1>
    </div>
  );
}
