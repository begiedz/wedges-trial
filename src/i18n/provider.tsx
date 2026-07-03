"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale } from "./types";

type I18nContextValue = {
  dictionary: Dictionary;
  locale: Locale;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: React.ReactNode;
  dictionary: Dictionary;
  locale: Locale;
};

export function I18nProvider({
  children,
  dictionary,
  locale,
}: I18nProviderProps) {
  return (
    <I18nContext.Provider value={{ dictionary, locale }}>
      {children}
    </I18nContext.Provider>
  );
}

function useI18nContext() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("I18nProvider is missing from the component tree.");
  }

  return context;
}

export function useDictionary() {
  return useI18nContext().dictionary;
}

export function useLocale() {
  return useI18nContext().locale;
}

export function useGameDictionary() {
  return useDictionary().game;
}

export function useDebugDictionary() {
  return useDictionary().debug;
}
