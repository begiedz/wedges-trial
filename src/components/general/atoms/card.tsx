import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children?: ReactNode | ReactNode[];
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn("bg-background p-4 border border-foreground", className)}
    >
      {children}
    </div>
  );
}
