import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps {
  iconSrc?: string;
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function Button({
  iconSrc,
  children,
  onClick,
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex gap-2 hover:bg-foreground p-3 border border-foreground font-medium text-foreground hover:text-background tracking-wide transition-all",
        className,
      )}
    >
      {iconSrc && <Image src={iconSrc} alt="" />}
      {children}
    </button>
  );
}
