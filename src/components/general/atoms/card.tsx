import type { ReactNode } from "react";

interface CardProps {
  children?: ReactNode | ReactNode[];
}

export default function Card({ children }: CardProps) {
  return (
    <div className="bg-background p-4 border border-primary">{children}</div>
  );
}
