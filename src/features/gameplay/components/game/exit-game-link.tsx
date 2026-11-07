"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useGameDictionary, useLocale } from "@/i18n/provider";
import { DialogAction } from "./game-dialog";

/** Leaving the screen preserves the authoritative run for session recovery. */
export function ExitGameLink({ control = false }: { control?: boolean }) {
  const t = useGameDictionary();
  const locale = useLocale();
  if (control) {
    return (
      <Link
        href={`/${locale}`}
        aria-label={t.actions.exitGame}
        aria-keyshortcuts="Escape"
        className="flex items-center gap-2"
      >
        {/* Replace this keycap with the supplied Esc image when available. */}
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center border border-foreground/60 bg-background-secondary text-lg sm:size-8 sm:text-xs"
        >
          Esc
        </span>
        <span>{t.actions.exitGame}</span>
      </Link>
    );
  }
  return (
    <DialogAction asChild>
      <Link href={`/${locale}`}>
        <LogOut aria-hidden="true" />
        {t.actions.exitGame}
      </Link>
    </DialogAction>
  );
}
