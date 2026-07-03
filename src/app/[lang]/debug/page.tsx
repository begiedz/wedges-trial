import { notFound } from "next/navigation";
import { TextLockTester } from "@/components/lock-debug/LockTester";
import { getDictionary, hasLocale } from "@/i18n/dictionaries";

export default async function Debug({ params }: PageProps<"/[lang]/debug">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const dict = await getDictionary(lang);

  return <TextLockTester copy={dict.debug} />;
}
