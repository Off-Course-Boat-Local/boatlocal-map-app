// Guest-app locale registry + resolution — the ONE place that knows which
// languages the guest app speaks and how a visitor's language is decided.
//
// Deliberately dependency-free and framework-free (no next/headers, no
// React): `resolveLocale` is a pure function over two strings, so the
// cookie-vs-Accept-Language precedence rules are trivially unit-testable
// (see locales.test.ts).
//
// Scope: GUEST app only. Studio/Admin stay English — nothing in src/app/
// studio or src/app/admin imports from src/lib/i18n.

export const SUPPORTED_LOCALES = ["en", "nl", "de", "es", "fr"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * The cookie the guest's explicit choice (LanguageSwitcher) is stored in.
 * Written client-side via document.cookie, read server-side by
 * src/lib/i18n/server.ts's getLocale().
 */
export const LOCALE_COOKIE = "map_app_lang";

/**
 * Each language named in ITSELF (endonym) — a Dutch visitor stuck on the
 * German UI must still recognise "Nederlands" in the switcher.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
};

/**
 * Flag shown beside each native name in the LanguageSwitcher dropdown.
 * 🇬🇧 (not 🇺🇸) for English — this is a European tourism product.
 */
export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  nl: "🇳🇱",
  de: "🇩🇪",
  es: "🇪🇸",
  fr: "🇫🇷",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

interface AcceptLanguageEntry {
  /** Lowercased base language, e.g. "de" out of "de-AT". */
  base: string;
  /** Parsed q-value, defaulting to 1 per RFC 9110. */
  quality: number;
  /** Position in the header, for stable ordering among equal q-values. */
  index: number;
}

/** Parses one `tag;q=0.8` chunk. Returns null for garbage or q=0 ("not acceptable"). */
function parseAcceptLanguageEntry(chunk: string, index: number): AcceptLanguageEntry | null {
  const [rawTag, ...params] = chunk.trim().split(";");
  const tag = rawTag?.trim().toLowerCase();
  if (!tag || tag === "*") return null;
  // A language tag starts with a 1-8 letter primary subtag (RFC 5646).
  const base = tag.split("-")[0];
  if (!/^[a-z]{1,8}$/.test(base)) return null;

  let quality = 1;
  for (const param of params) {
    const [key, value] = param.split("=").map((s) => s.trim().toLowerCase());
    if (key === "q") {
      const parsed = Number(value);
      // Garbage q-values fall back to 1 rather than poisoning the entry.
      quality = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
    }
  }
  if (quality <= 0) return null;

  return { base, quality, index };
}

/**
 * Resolves the guest's locale.
 *
 * Precedence:
 *  1. A valid `map_app_lang` cookie value — the guest's explicit choice
 *     always wins.
 *  2. The `Accept-Language` header, highest q-value first (ties keep header
 *     order), matched on the BASE language so `de-AT` → "de", `nl-BE` →
 *     "nl", `es-419` → "es".
 *  3. `DEFAULT_LOCALE` ("en") for everything else, including garbage input.
 */
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguageHeader: string | undefined,
): Locale {
  const fromCookie = cookieValue?.trim().toLowerCase();
  if (isLocale(fromCookie)) return fromCookie;

  if (acceptLanguageHeader) {
    const entries = acceptLanguageHeader
      .split(",")
      .map(parseAcceptLanguageEntry)
      .filter((entry): entry is AcceptLanguageEntry => entry !== null)
      // Stable sort: higher q first; equal q keeps the header's own order.
      .sort((a, b) => b.quality - a.quality || a.index - b.index);

    for (const entry of entries) {
      if (isLocale(entry.base)) return entry.base;
    }
  }

  return DEFAULT_LOCALE;
}
