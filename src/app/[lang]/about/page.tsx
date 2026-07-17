import { Anvil, InfinityIcon, Sparkles } from "lucide-react";
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
    <main className="overflow-hidden">
      <header className="relative border-border border-b bg-[radial-gradient(circle_at_75%_20%,rgba(208,163,94,0.12),transparent_30%),linear-gradient(120deg,#211f21,#292729)]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="mb-4 text-xs font-bold text-[#d0a35e] uppercase tracking-[0.28em]">
            {page.eyebrow}
          </p>
          <h1 className="max-w-4xl font-heading text-5xl leading-none tracking-wide sm:text-6xl">
            {page.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-secondary">
            {page.lead}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="grid gap-px overflow-hidden border border-foreground/15 bg-foreground/15 md:grid-cols-2">
          <article className="bg-background p-7 sm:p-10">
            <Anvil
              className="mb-7 size-7 text-[#d0a35e]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="font-heading text-3xl tracking-wide">
              {page.whatItIs.title}
            </h2>
            <p className="mt-4 leading-8 text-secondary">
              {page.whatItIs.body}
            </p>
          </article>
          <article className="bg-background p-7 sm:p-10">
            <InfinityIcon
              className="mb-7 size-7 text-[#d0a35e]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="font-heading text-3xl tracking-wide">
              {page.trial.title}
            </h2>
            <p className="mt-4 leading-8 text-secondary">{page.trial.body}</p>
          </article>
        </div>

        <section className="mt-16 grid gap-10 border-foreground/15 border-y py-14 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <Sparkles
              className="mb-6 size-7 text-[#d0a35e]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <p className="mb-3 text-xs font-bold text-[#d0a35e] uppercase tracking-[0.28em]">
              {page.inspiration.eyebrow}
            </p>
            <h2 className="font-heading text-4xl tracking-wide">
              {page.inspiration.title}
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-secondary">
            <p>{page.inspiration.body}</p>
            <p>
              {page.inspiration.influencePrefix}
              <a
                href="https://fingerschallenge.com"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline decoration-[#d0a35e] underline-offset-4 transition-colors hover:text-[#e5bd7d]"
              >
                {page.inspiration.influenceName}
              </a>
              {page.inspiration.influenceSuffix}
            </p>
          </div>
        </section>

        <div className="mt-14 flex flex-wrap gap-4">
          <Link
            href={`/${lang}/game`}
            className="border border-[#d0a35e] bg-[#d0a35e] px-6 py-3 font-bold text-background uppercase tracking-wider transition-colors hover:bg-transparent hover:text-[#e5bd7d]"
          >
            {dict.home.actions.play}
          </Link>
          <Link
            href={`/${lang}/how-to-play`}
            className="border border-foreground/35 px-6 py-3 font-bold uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background"
          >
            {page.howToPlayLink}
          </Link>
        </div>
      </div>
    </main>
  );
}
