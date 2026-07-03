"use client";

import Link from "next/link";
import { useLocale } from "@/i18n/provider";
import Logo from "../atoms/logo";

export default function Header() {
  const locale = useLocale();

  return (
    <header className="flex justify-center p-2">
      <Link href={`/${locale}`}>
        <Logo />
      </Link>
    </header>
  );
}
