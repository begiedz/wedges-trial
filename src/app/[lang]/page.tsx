import { Anvil, InfinityIcon, Pickaxe, Puzzle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n/dictionaries";

const FEATURE_ICONS = [InfinityIcon, Puzzle, Pickaxe] as const;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const home = dict.home;

  return (
    <main className="overflow-hidden">
      <section className="relative isolate min-h-[calc(100svh-5rem)] border-border border-b">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_68%_35%,rgba(189,145,77,0.13),transparent_34%),linear-gradient(120deg,#211f21_0%,#292729_54%,#1d1b1d_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(249,221,208,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(249,221,208,0.04)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-20">
          <div className="z-10 max-w-2xl">
            <p className="mb-5 flex items-center gap-3 font-semibold text-[0.7rem] text-[#d0a35e] uppercase tracking-[0.32em]">
              <span className="h-px w-9 bg-[#d0a35e]" aria-hidden="true" />
              {home.hero.eyebrow}
            </p>
            <h1 className="font-heading text-5xl leading-[0.9] tracking-wide sm:text-6xl lg:text-8xl">
              {home.hero.title}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-secondary sm:text-lg">
              {home.hero.lead}
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href={`/${lang}/game`}
                className="group inline-flex items-center gap-3 border border-[#d0a35e] bg-[#d0a35e] px-6 py-3 font-bold text-background uppercase tracking-wider transition-colors hover:bg-transparent hover:text-[#e5bd7d]"
              >
                {home.actions.play}
                <span
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
              <Link
                href={`/${lang}/about`}
                className="inline-flex items-center border border-foreground/35 px-6 py-3 font-bold text-foreground uppercase tracking-wider transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
              >
                {home.actions.discover}
              </Link>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-lg self-end justify-center md:h-[min(72svh,720px)]">
            <div className="absolute right-0 bottom-[8%] left-0 h-[55%] rounded-full bg-[#b88a48]/10 blur-3xl" />
            <Image
              src="/wedge.png"
              alt={home.hero.imageAlt}
              width={861}
              height={1054}
              priority
              sizes="(max-width: 768px) 90vw, 42vw"
              className="relative z-10 h-auto max-h-[66svh] w-auto object-contain object-bottom drop-shadow-[0_22px_28px_rgba(0,0,0,0.65)] md:absolute md:bottom-0 md:max-h-full"
            />
            <blockquote className="absolute right-0 bottom-5 z-20 max-w-[17rem] border-l-2 border-[#d0a35e] bg-background/90 p-4 shadow-2xl backdrop-blur sm:right-4 sm:bottom-10 md:-right-8 md:bottom-16">
              <p className="font-heading text-xl leading-snug tracking-wide">
                “{home.hero.quote}”
              </p>
              <footer className="mt-2 text-xs text-[#d0a35e] uppercase tracking-[0.25em]">
                — {home.hero.quoteAttribution}
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="mb-4 text-xs font-bold text-[#d0a35e] uppercase tracking-[0.28em]">
              {home.features.eyebrow}
            </p>
            <h2 className="font-heading text-4xl leading-tight tracking-wide sm:text-5xl">
              {home.features.title}
            </h2>
          </div>
          <p className="max-w-2xl self-end text-lg leading-8 text-secondary">
            {home.features.lead}
          </p>
        </div>

        <div className="mt-14 grid border-foreground/15 border-y md:grid-cols-3 md:divide-x md:divide-foreground/15">
          {home.features.items.map((feature, index) => {
            const Icon = FEATURE_ICONS[index];
            return (
              <article
                key={feature.title}
                className="group border-foreground/15 border-b px-1 py-9 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0"
              >
                <Icon
                  className="mb-7 size-7 text-[#d0a35e] transition-transform group-hover:-translate-y-1"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <h3 className="font-heading text-2xl tracking-wide">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-7 text-secondary">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="relative border-foreground/10 border-y bg-background-secondary">
        <div className="absolute top-0 bottom-0 left-1/2 hidden w-px bg-foreground/10 lg:block" />
        <div className="mx-auto grid max-w-6xl lg:grid-cols-2">
          <div className="flex min-h-96 items-center justify-center overflow-hidden px-5 py-20 md:px-8">
            <div className="relative flex size-64 items-center justify-center rounded-full border border-[#d0a35e]/25">
              <div className="absolute inset-6 rounded-full border border-foreground/10" />
              <div className="absolute h-px w-[150%] rotate-45 bg-foreground/10" />
              <div className="absolute h-px w-[150%] -rotate-45 bg-foreground/10" />
              <Anvil
                className="size-20 text-[#d0a35e]"
                strokeWidth={1}
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="flex flex-col justify-center px-5 py-20 md:px-12 lg:py-28">
            <p className="mb-4 text-xs font-bold text-[#d0a35e] uppercase tracking-[0.28em]">
              {home.origin.eyebrow}
            </p>
            <h2 className="font-heading text-4xl leading-tight tracking-wide sm:text-5xl">
              {home.origin.title}
            </h2>
            <p className="mt-7 text-lg leading-8 text-secondary">
              {home.origin.body}
            </p>
            <p className="mt-5 leading-7 text-secondary">
              {home.origin.influence}
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 text-center md:px-8 md:py-28">
        <p className="mx-auto max-w-3xl font-heading text-4xl leading-tight tracking-wide sm:text-6xl">
          {home.cta.title}
        </p>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-secondary">
          {home.cta.body}
        </p>
        <Link
          href={`/${lang}/game`}
          className="mt-9 inline-flex border border-[#d0a35e] px-7 py-3 font-bold text-[#e5bd7d] uppercase tracking-wider transition-colors hover:bg-[#d0a35e] hover:text-background"
        >
          {home.actions.accept}
        </Link>
      </section>
    </main>
  );
}
