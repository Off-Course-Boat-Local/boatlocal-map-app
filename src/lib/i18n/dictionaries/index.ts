// The locale → dictionary registry. Importable from BOTH server and client
// code: dictionaries are plain modules (strings + tiny template functions),
// so client components can select their own dictionary by locale rather
// than the server trying to serialize functions across the RSC boundary
// (which Next.js forbids). Only the `locale` string ever crosses it — see
// src/lib/i18n/LocaleProvider.tsx.

import type { Locale } from "../locales";
import en, { type Dictionary } from "./en";
import nl from "./nl";
import de from "./de";
import es from "./es";
import fr from "./fr";

export type { Dictionary };

export const DICTIONARIES: Record<Locale, Dictionary> = { en, nl, de, es, fr };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
