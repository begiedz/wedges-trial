import type en from "./dictionaries/en.json";

export const locales = ["en", "pl", "de", "ru"] as const;
export const defaultLocale: Locale = "en";

export type Locale = (typeof locales)[number];
export type Dictionary = typeof en;
export type GameDictionary = Dictionary["game"];
export type DebugDictionary = Dictionary["debug"];
