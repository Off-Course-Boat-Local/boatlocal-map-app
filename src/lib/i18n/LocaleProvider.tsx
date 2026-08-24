"use client";

// The guest app's i18n context. Mounted ONCE in src/app/(guest)/layout.tsx
// with the server-resolved locale; every guest client component reads
// `useI18n()` → { locale, t }.
//
// Only the `locale` STRING crosses the server→client boundary — dictionaries
// contain template functions, which Next.js cannot serialize as RSC props,
// so the provider picks its own dictionary from the shared registry
// (src/lib/i18n/dictionaries). All four dictionaries ship in the client
// bundle; they are small by design.
//
// The context DEFAULT is English, so components render sensibly without a
// provider — which is exactly what the existing component tests (and the
// /spike pages that reuse PlaceCard) rely on: no provider, English strings.

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { DICTIONARIES, type Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, type Locale } from "./locales";

export interface I18n {
  locale: Locale;
  t: Dictionary;
}

const I18nContext = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  t: DICTIONARIES[DEFAULT_LOCALE],
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18n>(() => ({ locale, t: DICTIONARIES[locale] }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** { locale, t } — defaults to English when no provider is mounted (tests, spike pages). */
export function useI18n(): I18n {
  return useContext(I18nContext);
}
