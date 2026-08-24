// Server-side locale resolution for the guest app.
//
// Reads the guest's explicit choice (the `map_app_lang` cookie the
// LanguageSwitcher writes) and the browser's Accept-Language header, and
// funnels both through the pure `resolveLocale` (src/lib/i18n/locales.ts —
// cookie wins; otherwise best Accept-Language base-language match;
// otherwise "en").
//
// Server Components only (imports next/headers). Client components get the
// same locale via LocaleProvider/useI18n instead. Deliberately does NOT
// touch src/proxy.ts — locale is per-request presentation state, not
// tenant routing.

import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locales";

export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language") ?? undefined,
  );
}

export { getDictionary, type Dictionary } from "./dictionaries";
