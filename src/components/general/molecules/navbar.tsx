"use client";

import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { START_NEW_RUN_EVENT } from "@/components/game/events";
import Button from "@/components/general/atoms/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useDictionary, useLocale } from "@/i18n/provider";
import { type Locale, locales } from "@/i18n/types";
import { cn } from "@/lib/utils";
import Logo from "../atoms/logo";

type NavItemKey = "language" | "solver" | "about" | "howToPlay";

type NavItem =
  | {
      key: "language";
      children: readonly Locale[];
    }
  | {
      key: Exclude<NavItemKey, "language">;
      href: string;
    };

const NAV_ITEMS: NavItem[] = [
  // { key: "solver", href: "/solver" },
  { key: "about", href: "/about" },
  { key: "howToPlay", href: "/how-to-play" },
  {
    key: "language",
    children: locales,
  },
];

const LOCALE_FLAGS = {
  en: "🇬🇧",
  pl: "🇵🇱",
  de: "🇩🇪",
  ru: "🇷🇺",
} satisfies Record<Locale, string>;

function getLocalizedHref(locale: Locale, href: string) {
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

function getLocaleHref(pathname: string, locale: Locale) {
  const localePattern = new RegExp(`^/(?:${locales.join("|")})(?=/|$)`);
  const pathWithoutLocale = pathname.replace(localePattern, "");

  return pathWithoutLocale ? `/${locale}${pathWithoutLocale}` : `/${locale}`;
}

export function Navbar() {
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();
  const pathname = usePathname();
  const dict = useDictionary();
  const nav = dict.nav;
  const isGamePage = pathname === `/${locale}/game`;

  const handleStartNewRun = React.useCallback(() => {
    window.dispatchEvent(new Event(START_NEW_RUN_EVENT));
    setOpen(false);
  }, []);

  return (
    <header className="top-0 z-50 sticky bg-background/80 backdrop-blur border-border border-b w-full">
      <div className="flex justify-between items-center gap-4 mx-auto px-4 sm:px-6 max-w-6xl h-16">
        {/* Brand */}
        <Link href={`/${locale}`} aria-label={nav.mobile.mainNavigation}>
          <Logo />
        </Link>

        {/* Desktop navigation */}
        <nav
          className="hidden relative md:flex items-center gap-1"
          aria-label={nav.mobile.mainNavigation}
        >
          {NAV_ITEMS.map((item) =>
            "children" in item ? (
              <DropdownMenu key={item.key} modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-2 data-[state=open]:bg-accent hover:bg-accent px-3 py-2 rounded-md font-medium text-foreground/80 data-[state=open]:text-foreground hover:text-foreground text-sm transition-colors"
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      {LOCALE_FLAGS[locale]}
                    </span>

                    <span>{nav.items[item.key]}</span>

                    <ChevronDown
                      className="w-4 h-4 group-data-[state=open]:rotate-180 transition-transform duration-200"
                      aria-hidden="true"
                    />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="center"
                  sideOffset={8}
                  className="bg-popover shadow-lg p-1.5 border-border min-w-max text-popover-foreground"
                >
                  {item.children.map((child) => (
                    <DropdownMenuItem key={child} asChild className="p-0">
                      <Link
                        href={getLocaleHref(pathname, child)}
                        aria-current={child === locale ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2 hover:bg-accent focus:bg-accent px-3 py-2 rounded-sm focus:outline-none w-full font-medium text-sm whitespace-nowrap transition-colors",
                          child === locale &&
                            "bg-accent text-accent-foreground",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="text-base leading-none"
                        >
                          {LOCALE_FLAGS[child]}
                        </span>

                        <span>{nav.locales[child]}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                key={item.key}
                href={getLocalizedHref(locale, item.href)}
                className="inline-flex items-center hover:bg-accent px-3 py-2 rounded-md font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
              >
                {nav.items[item.key]}
              </Link>
            ),
          )}
        </nav>

        {/* Desktop actions */}
        {isGamePage ? (
          <div className="hidden md:flex items-center gap-2">
            <Button onClick={handleStartNewRun}>
              {dict.game.actions.newRun}
            </Button>
          </div>
        ) : null}

        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="md:hidden inline-flex justify-center items-center hover:bg-accent rounded-md w-10 h-10 text-foreground transition-colors"
              aria-label={nav.mobile.openMenu}
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="flex flex-col bg-background p-6 border-border w-full max-w-xs sm:max-w-xs"
          >
            <SheetHeader className="text-left">
              <SheetTitle className="font-semibold text-base">
                {nav.mobile.menu}
              </SheetTitle>

              <SheetDescription className="sr-only">
                {nav.mobile.mainNavigation}
              </SheetDescription>
            </SheetHeader>

            <nav
              className="flex flex-col flex-1 gap-1 mt-6 overflow-y-auto"
              aria-label={nav.mobile.mainNavigation}
            >
              {NAV_ITEMS.map((item) =>
                "children" in item ? (
                  <MobileGroup
                    key={item.key}
                    item={item}
                    onNavigate={() => setOpen(false)}
                  />
                ) : (
                  <Link
                    key={item.key}
                    href={getLocalizedHref(locale, item.href)}
                    onClick={() => setOpen(false)}
                    className="hover:bg-accent px-3 py-2 rounded-md font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
                  >
                    {nav.items[item.key]}
                  </Link>
                ),
              )}
            </nav>

            {isGamePage ? (
              <div className="mt-6 pt-6 border-border border-t">
                <Button
                  onClick={handleStartNewRun}
                  className="justify-center w-full text-center"
                >
                  {dict.game.actions.newRun}
                </Button>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function MobileGroup({
  item,
  onNavigate,
}: {
  item: Extract<NavItem, { key: "language" }>;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const locale = useLocale();
  const pathname = usePathname();
  const dict = useDictionary();
  const nav = dict.nav;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex justify-between items-center hover:bg-accent px-3 py-2 rounded-md w-full font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-base leading-none">
            {LOCALE_FLAGS[locale]}
          </span>

          <span>{nav.items[item.key]}</span>
        </span>

        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <ul className="flex flex-col gap-1 mt-1 ml-3 pl-3 border-border border-l">
          {item.children.map((child) => (
            <li key={child}>
              <Link
                href={getLocaleHref(pathname, child)}
                onClick={onNavigate}
                aria-current={child === locale ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 hover:bg-accent px-3 py-2 rounded-md text-muted-foreground hover:text-foreground text-sm transition-colors",
                  child === locale && "bg-accent text-foreground",
                )}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {LOCALE_FLAGS[child]}
                </span>

                <span>{nav.locales[child]}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
