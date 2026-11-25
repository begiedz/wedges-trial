"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/general/molecules/navbar";
import { Button } from "@/components/ui/button";
import { useDictionary, useLocale } from "@/i18n/provider";
import { requestNewRun } from "../../events";

/** Composes the site navigation with gameplay's confirmation request. */
export function GameplayNavigation() {
  const pathname = usePathname();
  const locale = useLocale();
  const dict = useDictionary();

  return (
    <Navbar
      renderAction={
        pathname === `/${locale}/game`
          ? (onNavigate) => (
              <Button
                size="sm"
                className="justify-center w-full lg:w-auto lg:shrink-0 text-center whitespace-nowrap"
                onClick={() => {
                  requestNewRun();
                  onNavigate();
                }}
              >
                {dict.game.actions.newRun}
              </Button>
            )
          : undefined
      }
    />
  );
}
