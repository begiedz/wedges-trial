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
      <section className="isolate relative border-border border-b min-h-[calc(100svh-5rem)]">
        <div className="-z-20 absolute inset-0 bg-[radial-gradient(circle_at_68%_35%,rgba(189,145,77,0.13),transparent_34%),linear-gradient(120deg,#211f21_0%,#292729_54%,#1d1b1d_100%)]" />

        <div className="-z-10 absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(249,221,208,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(249,221,208,0.04)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div className="items-center gap-10 grid md:grid-cols-[0.9fr_1.1fr] mx-auto px-5 md:px-8 py-16 md:py-20 max-w-6xl min-h-[calc(100svh-5rem)]">
          <div className="z-10 max-w-2xl">
            <p className="flex items-center gap-3 mb-5 font-semibold text-[#d0a35e] text-[0.7rem] uppercase tracking-[0.32em]">
              <span className="bg-[#d0a35e] w-9 h-px" aria-hidden="true" />
              {home.hero.eyebrow}
            </p>

            <h1 className="font-heading text-5xl sm:text-6xl lg:text-8xl leading-[0.9] tracking-wide">
              {home.hero.title}
            </h1>

            <p className="mt-7 max-w-xl text-secondary text-base sm:text-lg leading-8">
              {home.hero.lead}
            </p>

            <div className="flex flex-wrap gap-4 mt-9">
              <Link
                href={`/${lang}/game`}
                className="group inline-flex items-center gap-3 bg-[#d0a35e] hover:bg-transparent px-6 py-3 border border-[#d0a35e] font-bold text-background hover:text-[#e5bd7d] uppercase tracking-wider transition-colors"
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
                className="inline-flex items-center hover:bg-foreground px-6 py-3 border border-foreground/35 hover:border-foreground font-bold text-foreground hover:text-background uppercase tracking-wider transition-colors"
              >
                {home.actions.discover}
              </Link>
            </div>
          </div>

          <div className="relative flex justify-center self-end mx-auto w-full max-w-2xl md:min-h-[620px] lg:min-h-[700px]">
            <div className="right-0 bottom-[8%] left-0 absolute bg-[#b88a48]/10 blur-3xl rounded-full h-[55%]" />

            <Image
              src="/wedge.png"
              alt={home.hero.imageAlt}
              width={861}
              height={1054}
              priority
              sizes="(max-width: 768px) 90vw, 760px"
              className="md:bottom-0 z-10 md:absolute relative drop-shadow-[0_22px_28px_rgba(0,0,0,0.65)] w-auto md:w-[620px] lg:w-[720px] xl:w-[800px] h-auto md:h-auto max-h-[66svh] md:max-h-none object-bottom object-contain"
            />

            <blockquote className="right-0 sm:right-4 md:-right-8 bottom-5 sm:bottom-10 md:bottom-16 z-20 absolute bg-background/90 shadow-2xl backdrop-blur p-4 border-[#d0a35e] border-l-2 max-w-[17rem]">
              <p className="font-heading text-xl leading-snug tracking-wide">
                “{home.hero.quote}”
              </p>

              <p className="mt-2 text-[#d0a35e] text-xs uppercase tracking-[0.25em]">
                — {home.hero.quoteAttribution}
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="mx-auto px-5 md:px-8 py-20 md:py-28 max-w-6xl">
        <div className="gap-10 lg:gap-20 grid lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="mb-4 font-bold text-[#d0a35e] text-xs uppercase tracking-[0.28em]">
              {home.features.eyebrow}
            </p>

            <h2 className="font-heading text-4xl sm:text-5xl leading-tight tracking-wide">
              {home.features.title}
            </h2>
          </div>

          <p className="self-end max-w-2xl text-secondary text-lg leading-8">
            {home.features.lead}
          </p>
        </div>

        <div className="grid md:grid-cols-3 mt-14 border-foreground/15 border-y md:divide-x md:divide-foreground/15">
          {home.features.items.map((feature, index) => {
            const Icon = FEATURE_ICONS[index];

            return (
              <article
                key={feature.title}
                className="group px-1 md:px-8 py-9 md:last:pr-0 md:first:pl-0 border-foreground/15 border-b md:border-b-0 last:border-b-0"
              >
                <Icon
                  className="mb-7 size-7 text-[#d0a35e] transition-transform group-hover:-translate-y-1"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />

                <h3 className="font-heading text-2xl tracking-wide">
                  {feature.title}
                </h3>

                <p className="mt-3 text-secondary leading-7">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="relative bg-background-secondary border-foreground/10 border-y">
        <div className="hidden lg:block top-0 bottom-0 left-1/2 absolute bg-foreground/10 w-px" />

        <div className="grid lg:grid-cols-2 mx-auto max-w-6xl">
          <div className="flex justify-center items-center px-5 md:px-8 py-20 min-h-96 overflow-hidden">
            <div className="relative flex justify-center items-center border border-[#d0a35e]/25 rounded-full size-64">
              <div className="absolute inset-6 border border-foreground/10 rounded-full" />
              <div className="absolute bg-foreground/10 w-[150%] h-px rotate-45" />
              <div className="absolute bg-foreground/10 w-[150%] h-px -rotate-45" />

              <Anvil
                className="size-20 text-[#d0a35e]"
                strokeWidth={1}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center px-5 md:px-12 py-20 lg:py-28">
            <p className="mb-4 font-bold text-[#d0a35e] text-xs uppercase tracking-[0.28em]">
              {home.origin.eyebrow}
            </p>

            <h2 className="font-heading text-4xl sm:text-5xl leading-tight tracking-wide">
              {home.origin.title}
            </h2>

            <p className="mt-7 text-secondary text-lg leading-8">
              {home.origin.body}
            </p>

            <p className="mt-5 text-secondary leading-7">
              {home.origin.influencePrefix}

              <a
                href="https://fingerschallenge.com"
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:text-[#e5bd7d] decoration-[#d0a35e] underline underline-offset-4 transition-colors"
              >
                {home.origin.influenceName}
              </a>

              {home.origin.influenceSuffix}
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 py-20 md:py-28 text-center">
        <p className="mx-auto max-w-3xl font-heading text-4xl sm:text-6xl leading-tight tracking-wide">
          {home.cta.title}
        </p>

        <p className="mx-auto mt-5 max-w-xl text-secondary text-lg leading-8">
          {home.cta.body}
        </p>

        <Link
          href={`/${lang}/game`}
          className="inline-flex hover:bg-[#d0a35e] mt-9 px-7 py-3 border border-[#d0a35e] font-bold text-[#e5bd7d] hover:text-background uppercase tracking-wider transition-colors"
        >
          {home.actions.accept}
        </Link>
      </section>
    </main>
  );
}
