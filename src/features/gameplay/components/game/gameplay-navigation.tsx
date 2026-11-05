"use client";

import { usePathname } from "next/navigation";
import Button from "@/components/general/atoms/button";
import { Navbar } from "@/components/general/molecules/navbar";
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
                className="justify-center w-full lg:w-auto text-center"
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
