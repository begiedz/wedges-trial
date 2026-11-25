'use client';

import Link from 'next/link';
import { useGameDictionary, useLocale } from '@/i18n/provider';
import { DialogAction } from './game-dialog';

/** Leaving the screen preserves the authoritative run for session recovery. */
export function ExitGameLink({ control = false }: { control?: boolean }) {
  const t = useGameDictionary();
  const locale = useLocale();
  if (control) {
    return (
      <Link
        href={`/${locale}`}
        aria-label={t.actions.exitGame}
        aria-keyshortcuts='Escape'
        className='flex items-center gap-2'
      >
        <span>{t.actions.exitGame}</span>
      </Link>
    );
  }
  return (
    <DialogAction asChild>
      <Link href={`/${locale}`}>{t.actions.exitGame}</Link>
    </DialogAction>
  );
}
