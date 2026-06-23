import Image from "next/image";
import type { ReactNode } from "react";

interface ButtonProps {
  iconSrc?: string;
  children?: ReactNode;
}

export default function Button({ iconSrc, children }: ButtonProps) {
  return (
    <button
      type="button"
      className="flex gap-2 hover:bg-primary p-3 border border-primary font-medium text-primary hover:text-background transition-all"
    >
      {iconSrc && <Image src={iconSrc} alt="" />}
      {children}
    </button>
  );
}
