"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import Logo from "../atoms/logo";

type NavChild = { title: string; href: string; description: string };
type NavItem = { title: string; href?: string; children?: NavChild[] };

const NAV_ITEMS: NavItem[] = [
  {
    title: "Language",
    children: [
      {
        title: "EN",
        href: "/en",
        description: "",
      },
      {
        title: "PL",
        href: "/pl",
        description: "",
      },
      {
        title: "DE",
        href: "/de",
        description: "",
      },
      {
        title: "RU",
        href: "/ru",
        description: "",
      },
    ],
  },
  { title: "Solver", href: "/solver" },
  { title: "About", href: "/about" },
  { title: "How to play", href: "/how-to-play" },
];

export function Navbar() {
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();

  return (
    <header className="top-0 z-50 sticky bg-background/80 backdrop-blur border-border border-b w-full">
      <div className="flex justify-between items-center gap-4 mx-auto px-4 sm:px-6 max-w-6xl h-16">
        {/* Brand */}
        <Link href={`/${locale}`}>
          <Logo />
        </Link>

        {/* Desktop navigation */}
        <NavigationMenu.Root className="hidden relative md:flex">
          <NavigationMenu.List className="flex items-center gap-1">
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <NavigationMenu.Item key={item.title}>
                  <NavigationMenu.Trigger className="group inline-flex items-center gap-1 data-[state=open]:bg-accent hover:bg-accent px-3 py-2 rounded-md font-medium text-foreground/80 data-[state=open]:text-foreground hover:text-foreground text-sm transition-colors">
                    {item.title}
                    <ChevronDown
                      className="w-4 h-4 group-data-[state=open]:rotate-180 transition-transform duration-200"
                      aria-hidden="true"
                    />
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content className="top-0 left-0 absolute w-full data-[motion=from-start]:animate-in data-[motion=to-start]:animate-out data-[motion=from-start]:fade-in data-[motion=to-start]:fade-out">
                    <ul className="gap-1 grid p-2 w-[420px]">
                      {item.children.map((child) => (
                        <li key={child.title}>
                          <NavigationMenu.Link asChild>
                            <Link
                              href={child.href}
                              className="block hover:bg-accent focus:bg-accent p-3 rounded-md focus:outline-none transition-colors"
                            >
                              <div className="font-medium text-foreground text-sm">
                                {child.title}
                              </div>
                              <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                                {child.description}
                              </p>
                            </Link>
                          </NavigationMenu.Link>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              ) : (
                <NavigationMenu.Item key={item.title}>
                  <NavigationMenu.Link asChild>
                    <Link
                      href={item.href!}
                      className="inline-flex items-center hover:bg-accent px-3 py-2 rounded-md font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
                    >
                      {item.title}
                    </Link>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              ),
            )}
          </NavigationMenu.List>

          <div className="top-full left-0 absolute flex justify-center w-full">
            <NavigationMenu.Viewport
              className={cn(
                "relative bg-popover shadow-lg mt-2 border border-border rounded-lg overflow-hidden text-popover-foreground origin-top",
                "h-[var(--radix-navigation-menu-viewport-height)] w-[var(--radix-navigation-menu-viewport-width)] transition-[width,height] duration-200",
                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=open]:zoom-in-95",
              )}
            />
          </div>
        </NavigationMenu.Root>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="#signin"
            className="px-3 py-2 rounded-md font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="#get-started"
            className="bg-primary hover:opacity-90 px-4 py-2 rounded-md font-medium text-primary-foreground text-sm transition-opacity"
          >
            Get started
          </Link>
        </div>

        {/* Mobile menu */}
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="md:hidden inline-flex justify-center items-center hover:bg-accent rounded-md w-10 h-10 text-foreground transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="md:hidden z-50 fixed inset-0 bg-foreground/20 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />
            <Dialog.Content className="md:hidden right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right z-50 fixed inset-y-0 flex flex-col bg-background shadow-xl p-6 border-border border-l w-full max-w-xs data-[state=closed]:animate-out data-[state=open]:animate-in">
              <div className="flex justify-between items-center">
                <Dialog.Title className="font-semibold text-base">
                  Menu
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="inline-flex justify-center items-center hover:bg-accent rounded-md w-9 h-9 text-foreground transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                Main navigation links
              </Dialog.Description>

              <nav className="flex flex-col flex-1 gap-1 mt-6 overflow-y-auto">
                {NAV_ITEMS.map((item) =>
                  item.children ? (
                    <MobileGroup
                      key={item.title}
                      item={item}
                      onNavigate={() => setOpen(false)}
                    />
                  ) : (
                    <Link
                      key={item.title}
                      href={item.href!}
                      onClick={() => setOpen(false)}
                      className="hover:bg-accent px-3 py-2 rounded-md font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
                    >
                      {item.title}
                    </Link>
                  ),
                )}
              </nav>

              <div className="flex flex-col gap-2 mt-6 pt-6 border-border border-t">
                <Link
                  href="#signin"
                  onClick={() => setOpen(false)}
                  className="hover:bg-accent px-4 py-2 border border-border rounded-md font-medium text-foreground text-sm text-center transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="#get-started"
                  onClick={() => setOpen(false)}
                  className="bg-primary hover:opacity-90 px-4 py-2 rounded-md font-medium text-primary-foreground text-sm text-center transition-opacity"
                >
                  Get started
                </Link>
              </div>
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
  item: NavItem;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex justify-between items-center hover:bg-accent px-3 py-2 rounded-md w-full font-medium text-foreground/80 hover:text-foreground text-sm transition-colors"
      >
        {item.title}
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
          {item.children!.map((child) => (
            <li key={child.title}>
              <Link
                href={child.href}
                onClick={onNavigate}
                className="block hover:bg-accent px-3 py-2 rounded-md text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {child.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
