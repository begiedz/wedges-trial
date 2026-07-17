import { Gamepad2, Goal, KeyRound, RotateCw } from "lucide-react";
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
    <main className="overflow-hidden">
      <header className="border-border border-b bg-[radial-gradient(circle_at_75%_20%,rgba(208,163,94,0.12),transparent_30%),linear-gradient(120deg,#211f21,#292729)]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="mb-4 text-xs font-bold text-[#d0a35e] uppercase tracking-[0.28em]">
            {page.eyebrow}
          </p>
          <h1 className="font-heading text-5xl leading-none tracking-wide sm:text-6xl">
            {page.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-secondary">
            {page.lead}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="border border-foreground/15 bg-background-secondary p-7 sm:p-9">
            <Goal
              className="mb-6 size-7 text-[#d0a35e]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="font-heading text-3xl tracking-wide">
              {page.objective.title}
            </h2>
            <p className="mt-4 leading-8 text-secondary">
              {page.objective.body}
            </p>
          </article>
          <article className="border border-foreground/15 p-7 sm:p-9">
            <RotateCw
              className="mb-6 size-7 text-[#d0a35e]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="font-heading text-3xl tracking-wide">
              {page.mechanism.title}
            </h2>
            <p className="mt-4 leading-8 text-secondary">
              {page.mechanism.body}
            </p>
          </article>
        </div>

        <section className="mt-16 grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <Gamepad2
              className="mb-6 size-7 text-[#d0a35e]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="font-heading text-4xl tracking-wide">
              {page.stepsTitle}
            </h2>
          </div>
          <ol className="space-y-5">
            {page.steps.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[2.5rem_1fr] gap-4 border-foreground/15 border-b pb-5 leading-7 text-secondary"
              >
                <span className="font-heading text-2xl text-[#d0a35e]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-16 grid gap-10 border-foreground/15 border-y py-14 lg:grid-cols-2 lg:gap-16">
          <section>
            <KeyRound
              className="mb-6 size-7 text-[#d0a35e]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="font-heading text-3xl tracking-wide">
              {page.rulesTitle}
            </h2>
            <ul className="mt-6 space-y-4 text-secondary">
              {page.rules.map((rule) => (
                <li key={rule} className="flex gap-3 leading-7">
                  <span className="text-[#d0a35e]" aria-hidden="true">
                    ◆
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <Gamepad2
              className="mb-6 size-7 text-[#d0a35e]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="font-heading text-3xl tracking-wide">
              {page.controlsTitle}
            </h2>
            <ul className="mt-6 space-y-4 text-secondary">
              {page.controls.map((control) => (
                <li
                  key={control}
                  className="border-foreground/15 border-b pb-3 leading-7"
                >
                  {control}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <Link
          href={`/${lang}/game`}
          className="mt-14 inline-flex border border-[#d0a35e] bg-[#d0a35e] px-6 py-3 font-bold text-background uppercase tracking-wider transition-colors hover:bg-transparent hover:text-[#e5bd7d]"
        >
          {dict.home.actions.play}
        </Link>
      </div>
    </main>
  );
}
