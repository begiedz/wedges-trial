import Image from "next/image";
import { cn } from "@/lib/utils";

interface ItemFrameProps {
  className?: string;
  item: string;
  amount?: number;
  width: number;
  height: number;
  alt: string;
}

export default function ItemFrame({
  className,
  item,
  amount = 0,
  width,
  height,
  alt,
}: ItemFrameProps) {
  return (
    <div
      className={cn(
        "relative bg-background border border-foreground aspect-square",
        className,
      )}
    >
      <Image
        src={item}
        width={width}
        height={height}
        alt={alt}
        className="-translate-y-2"
      />
      <div className="right-1 bottom-1 absolute flex justify-center items-center bg-foreground p-1 min-w-5">
        <span className="font-heading text-background">{amount}</span>
      </div>
    </div>
  );
}
