import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n/dictionaries";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="flex flex-col items-center">
      <Link
        href={`/${lang}/game`}
        className="flex gap-2 hover:bg-foreground p-3 border border-foreground text-foreground hover:text-background transition-all"
      >
        {dict.home.actions.play}
      </Link>
    </main>
  );
}
