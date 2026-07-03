"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import Button from "@/components/general/atoms/button";
import { START_NEW_RUN_EVENT } from "@/components/game/events";
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
  { key: "solver", href: "/solver" },
  { key: "about", href: "/about" },
  { key: "howToPlay", href: "/how-to-play" },
  {
    key: "language",
    children: locales,
  },
];

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
    <header className="top-0 z-50 sticky bg-background/80 backdrop-blur mb-4 border-border border-b w-full">
      <div className="flex justify-between items-center gap-4 mx-auto px-4 sm:px-6 max-w-6xl h-16">
        {/* Brand */}
        <Link href={`/${locale}`}>
          <Logo />
        </Link>

        {/* Desktop navigation */}
        <NavigationMenu.Root className="hidden relative md:flex">
          <NavigationMenu.List className="flex items-center gap-1">
            {NAV_ITEMS.map((item) =>
              "children" in item ? (
                <NavigationMenu.Item key={item.key} className="relative">
                  <NavigationMenu.Trigger className="group inline-flex items-center gap-1 data-[state=open]:bg-accent hover:bg-accent px-3 py-2 rounded-md font-medium text-foreground/80 data-[state=open]:text-foreground hover:text-foreground text-sm transition-colors">
                    {nav.items[item.key]}
                    <ChevronDown
                      className="w-4 h-4 group-data-[state=open]:rotate-180 transition-transform duration-200"
                      aria-hidden="true"
                    />
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content className="top-full left-1/2 z-20 absolute mt-2 -translate-x-1/2 data-[motion=from-start]:animate-in data-[motion=to-start]:animate-out data-[motion=from-start]:fade-in data-[motion=to-start]:fade-out">
                    <ul className="gap-1 grid p-2 w-[420px]">
                      {item.children.map((child) => (
                        <li key={child}>
                          <NavigationMenu.Link asChild>
                            <Link
                              href={getLocaleHref(pathname, child)}
                              className="block bg-popover hover:bg-accent focus:bg-accent shadow-lg p-3 border border-border rounded-md focus:outline-none transition-colors"
                            >
                              <div className="font-medium text-foreground text-sm">
                                {nav.locales[child]}
                              </div>
                            </Link>
                          </NavigationMenu.Link>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              ) : (
                <NavigationMenu.Item key={item.key}>
                  <NavigationMenu.Link asChild>
                    <Link
                      href={getLocalizedHref(locale, item.href)}
                      className="inline-flex items-center hover:bg-accent px-3 py-2 rounded-md font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
                    >
                      {nav.items[item.key]}
                    </Link>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              ),
            )}
          </NavigationMenu.List>
        </NavigationMenu.Root>

        {/* Desktop actions */}
        {isGamePage ? (
          <div className="hidden md:flex items-center gap-2">
            <Button onClick={handleStartNewRun}>
              {dict.game.actions.newRun}
            </Button>
          </div>
        ) : null}

        {/* Mobile menu */}
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="md:hidden inline-flex justify-center items-center hover:bg-accent rounded-md w-10 h-10 text-foreground transition-colors"
              aria-label={nav.mobile.openMenu}
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="md:hidden z-50 fixed inset-0 bg-foreground/20 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />
            <Dialog.Content className="md:hidden right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right z-50 fixed inset-y-0 flex flex-col bg-background shadow-xl p-6 border-border border-l w-full max-w-xs data-[state=closed]:animate-out data-[state=open]:animate-in">
              <div className="flex justify-between items-center">
                <Dialog.Title className="font-semibold text-base">
                  {nav.mobile.menu}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="inline-flex justify-center items-center hover:bg-accent rounded-md w-9 h-9 text-foreground transition-colors"
                    aria-label={nav.mobile.closeMenu}
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                {nav.mobile.mainNavigation}
              </Dialog.Description>

              <nav className="flex flex-col flex-1 gap-1 mt-6 overflow-y-auto">
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
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
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
  const pathname = usePathname();
  const dict = useDictionary();
  const nav = dict.nav;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex justify-between items-center hover:bg-accent px-3 py-2 rounded-md w-full font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
      >
        {nav.items[item.key]}
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <ul className="flex flex-col gap-1 mt-1 ml-3 pl-3 border-border border-l">
          {item.children.map((child) => (
            <li key={child}>
              <Link
                href={getLocaleHref(pathname, child)}
                onClick={onNavigate}
                className="block hover:bg-accent px-3 py-2 rounded-md text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {nav.locales[child]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
