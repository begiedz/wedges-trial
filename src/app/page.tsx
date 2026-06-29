import Button from "@/components/general/atoms/button";

export default function Home() {
  return (
    <main className="flex flex-col items-center">
      <Button>
        <a href="/game">Play</a>
      </Button>
    </main>
  );
}
