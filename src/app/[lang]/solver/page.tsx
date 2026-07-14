import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n/dictionaries";

export default async function SolverPage({
  params,
}: PageProps<"/[lang]/solver">) {
  // page in progress
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const page = dict.nav.pages.solver;

  return (
    <main className="mx-auto px-4 sm:px-6 py-12 max-w-3xl">
      <div className="space-y-6">
        <h1 className="font-semibold text-3xl">{page.title}</h1>
        <p className="text-muted-foreground text-lg">{page.lead}</p>
        <p className="text-muted-foreground">{page.body}</p>
      </div>
    </main>
  );
}
