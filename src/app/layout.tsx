import type { Metadata } from "next";
import { Noto_Serif } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Header from "@/components/general/molecules/header";

const boucherieBlock = localFont({
  src: "../assets/fonts/BoucherieBlockExtended.otf",
  variable: "--font-boucherie",
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wedge's Trial",
  description:
    "Logic puzzle game inspired by Gothic's Remake lockpicking mechanism.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${boucherieBlock.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="flex flex-col min-h-full">
        <Header />
        {children}
      </body>
    </html>
  );
}
