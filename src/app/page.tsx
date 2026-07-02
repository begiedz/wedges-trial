import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center">
      <Link
        href="/game"
        className="flex gap-2 hover:bg-foreground p-3 border border-foreground text-foreground hover:text-background transition-all"
      >
        Play
      </Link>
    </main>
  );
}
