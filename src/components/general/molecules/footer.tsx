"use client";

import Link from "next/link";
import { useDictionary, useLocale } from "@/i18n/provider";
import BegiedzLogo from "../atoms/begiedz-logo";
import Logo from "../atoms/logo";

export default function Footer() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const footer = dictionary.footer;

  const pageLinks = [
    { href: `/${locale}`, label: footer.home },
    { href: `/${locale}/game`, label: dictionary.home.actions.play },
    { href: `/${locale}/about`, label: dictionary.nav.items.about },
    {
      href: `/${locale}/how-to-play`,
      label: dictionary.nav.items.howToPlay,
    },
  ];

  return (
    <footer className="bg-background-secondary mt-auto border-border border-t">
      <div className="gap-10 grid grid-cols-1 md:grid-cols-[1fr_auto] mx-auto px-5 md:px-8 py-10 w-full max-w-7xl">
        <aside className="space-y-5 max-w-xl">
          <Link
            href={`/${locale}`}
            aria-label={footer.home}
            className="inline-flex"
          >
            <Logo />
          </Link>

          <p className="text-secondary text-sm leading-6">
            {footer.disclaimer}
          </p>
          <div className="space-y-2">
            <BegiedzLogo size={20} textSize="text-base" subtextSize="text-xs" />

            <p className="text-secondary text-sm">
              {footer.madeBy}{" "}
              <a
                href="https://begiedz.dev"
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:underline underline-offset-4 transition-colors"
              >
                Dariusz Begiedza
              </a>
            </p>
          </div>
        </aside>

        <div className="gap-10 md:gap-16 lg:gap-24 grid grid-cols-1 sm:grid-cols-2">
          <nav aria-label={footer.navigation}>
            <h2 className="mb-3 font-heading text-lg tracking-wide">
              {footer.navigation}
            </h2>

            <ul className="gap-2 grid text-sm">
              {pageLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-secondary hover:text-foreground hover:underline underline-offset-4 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={footer.inspiration}>
            <h2 className="mb-3 font-heading text-lg tracking-wide">
              {footer.inspiration}
            </h2>

            <ul className="gap-2 grid text-sm">
              <li>
                <a
                  href="https://fingerschallenge.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary hover:text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  {footer.fingersChallenge}
                </a>
              </li>

              <li>
                <a
                  href="https://www.thqnordic.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary hover:text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  {footer.publisher}
                </a>
              </li>

              <li>
                <a
                  href="https://gothic.thqnordic.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary hover:text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  Gothic
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
