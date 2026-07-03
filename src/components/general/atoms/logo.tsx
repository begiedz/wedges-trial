import Image from "next/image";
import gothicLogo from "@/assets/images/logo.png";

type LogoProps = {
  alt: string;
  title: string;
};

export default function Logo({ alt, title }: LogoProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Image
        src={gothicLogo.src}
        alt={alt}
        width={360}
        height={150}
        className="drop-shadow-black drop-shadow-md w-10"
      />
      <h1 className="text-shadow-black text-shadow-md font-heading text-xl">
        {title}
      </h1>
    </div>
  );
}
