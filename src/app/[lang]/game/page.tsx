import { notFound } from "next/navigation";
import { GameClient } from "@/components/game/GameClient";
import { getDictionary, hasLocale } from "@/i18n/dictionaries";

export default async function Game({ params }: PageProps<"/[lang]/game">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return <GameClient copy={dict.game} />;
}
