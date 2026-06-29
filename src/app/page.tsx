import Link from "next/link";
import Button from "@/components/general/atoms/button";

export default function Home() {
  return (
    <main className="flex flex-col items-center">
      <Link
        href="/game"
        className="flex gap-2 hover:bg-foreground p-3 border border-foreground font-medium text-foreground hover:text-background tracking-wide transition-all"
      >
        Play
      </Link>
    </main>
  );
}
