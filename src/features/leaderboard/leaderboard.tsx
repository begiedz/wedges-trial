"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LeaderboardResponse } from "@/api/contracts";
import { TransportError } from "@/client/game/api";
import { getLeaderboardPage } from "@/client/leaderboard";
import { Button } from "@/components/ui/button";
import { useDictionary, useLocale } from "@/i18n/provider";

export function Leaderboard() {
  const dictionary = useDictionary();
  const t = dictionary.leaderboard;
  const locale = useLocale();
  const [pages, setPages] = useState<LeaderboardResponse[]>([]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<"error" | "expired" | null>(null);
  const page = pages[index];
  const cursor = index > 0 ? pages[index - 1]?.nextCursor : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt triggers retry/refresh.
  useEffect(() => {
    setError(null);
    if (page) return;
    const controller = new AbortController();
    getLeaderboardPage(index, cursor ?? undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setPages((previous) => [...previous.slice(0, index), result]);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof TransportError &&
              failure.status === 400 &&
              cursor
              ? "expired"
              : "error",
          );
      });
    return () => controller.abort();
  }, [page, cursor, index, attempt]);

  function refresh() {
    setPages([]);
    setIndex(0);
    setError(null);
    setAttempt((value) => value + 1);
  }
  const numbers = new Intl.NumberFormat(locale);
  const dates = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-12 md:px-8">
      <header className="space-y-4">
        <p className="text-[#d0a35e] uppercase tracking-wider">{t.subtitle}</p>
        <h1 className="font-heading text-4xl sm:text-6xl">{t.title}</h1>
        <p className="text-secondary">{t.description}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/game`}>{dictionary.home.actions.play}</Link>
        </Button>
      </header>
      <section
        aria-label={t.title}
        aria-busy={!page && !error}
        className="space-y-6"
      >
        <output className="block">
          {error
            ? t[error]
            : !page
              ? t.loading
              : !page.entries.length
                ? t.empty
                : t.page.replace("{page}", numbers.format(index + 1))}
        </output>
        {error === "error" && (
          <Button
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            {t.retry}
          </Button>
        )}
        {!!page?.entries.length && (
          <section
            className="overflow-x-auto"
            aria-label={t.title}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users need to scroll the table horizontally.
            tabIndex={0}
          >
            <table className="w-full text-left tabular-nums">
              <caption className="sr-only">{t.subtitle}</caption>
              <thead>
                <tr>
                  {[t.rank, t.nickname, t.ore, t.chests, t.finished].map(
                    (label) => (
                      <th
                        key={label}
                        scope="col"
                        className="border-border border-b px-3 py-4"
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {page.entries.map((entry) => (
                  <tr key={entry.runId}>
                    <td className="border-border border-b px-3 py-4">
                      {numbers.format(entry.rank)}
                    </td>
                    <th
                      scope="row"
                      className="max-w-48 break-words border-border border-b px-3 py-4 font-medium"
                    >
                      {entry.displayName}
                    </th>
                    <td className="border-border border-b px-3 py-4">
                      {numbers.format(entry.oreNuggets)}
                    </td>
                    <td className="border-border border-b px-3 py-4">
                      {numbers.format(entry.openedChests)}
                    </td>
                    <td className="whitespace-nowrap border-border border-b px-3 py-4">
                      <time dateTime={entry.finishedAt}>
                        {dates.format(new Date(entry.finishedAt))}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <nav
          aria-label={t.pagination}
          className="flex flex-wrap items-center gap-3"
        >
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            {t.previous}
          </Button>
          <Button
            variant="outline"
            disabled={!page?.nextCursor}
            onClick={() => setIndex((value) => value + 1)}
          >
            {t.next}
          </Button>
          <Button variant="outline" onClick={refresh}>
            {t.refresh}
          </Button>
        </nav>
      </section>
    </main>
  );
}
