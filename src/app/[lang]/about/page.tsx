import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n/dictionaries";

export default async function AboutPage({
  params,
}: PageProps<"/[lang]/about">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const page = dict.nav.pages.about;

  return (
    <main className="mx-auto px-4 py-12 sm:px-6 max-w-3xl">
      <div className="space-y-6">
        <h1 className="font-semibold text-3xl">{page.title}</h1>
        <p className="text-muted-foreground text-lg">{page.lead}</p>
        <p className="text-muted-foreground">{page.body}</p>
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
