import { notFound } from "next/navigation";
import { Leaderboard } from "@/features/leaderboard";
import { hasLocale } from "@/i18n/dictionaries";

export default async function LeaderboardPage({
  params,
}: PageProps<"/[lang]/leaderboard">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <Leaderboard />;
}
