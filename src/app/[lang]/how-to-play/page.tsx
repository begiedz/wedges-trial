import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n/dictionaries";

export default async function HowToPlayPage({
  params,
}: PageProps<"/[lang]/how-to-play">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const page = dict.nav.pages.howToPlay;

  return (
    <main className="mx-auto px-4 py-12 sm:px-6 max-w-3xl">
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="font-semibold text-3xl">{page.title}</h1>
          <p className="text-muted-foreground text-lg">{page.lead}</p>
        </div>

        <ol className="space-y-3 text-muted-foreground list-decimal list-inside">
          {page.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <ul className="space-y-3 text-muted-foreground list-disc list-inside">
          {page.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>

        <Link
          href={`/${lang}/game`}
          className="inline-flex hover:bg-foreground px-4 py-3 border border-foreground text-foreground hover:text-background transition-all"
        >
          {dict.home.actions.play}
        </Link>
      </div>
    </main>
  );
}
