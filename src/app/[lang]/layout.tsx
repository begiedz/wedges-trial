import type { Metadata } from "next";
import { Noto_Serif } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import "../globals.css";
import Header from "@/components/general/molecules/header";
import { getDictionary, hasLocale } from "@/i18n/dictionaries";
import { locales } from "@/i18n/types";

const boucherieBlock = localFont({
  src: "../../assets/fonts/BoucherieBlockExtended.otf",
  variable: "--font-boucherie",
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
});

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${boucherieBlock.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="flex flex-col min-h-full">
        <Header
          homeHref={`/${lang}`}
          logoAlt={dict.common.brand.logoAlt}
          title={dict.common.brand.name}
        />
        {children}
      </body>
    </html>
  );
}
