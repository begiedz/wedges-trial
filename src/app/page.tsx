import Button from "@/components/general/atoms/button";

export default function Home() {
  return (
    <main className="flex flex-col items-center">
      <a href="/game">
        <Button>Play</Button>
      </a>
    </main>
  );
}
