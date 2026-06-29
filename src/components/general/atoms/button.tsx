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
      className="flex gap-2 hover:bg-foreground p-3 border border-foreground font-medium text-foreground hover:text-background tracking-wide transition-all"
    >
      {iconSrc && <Image src={iconSrc} alt="" />}
      {children}
    </button>
  );
}
