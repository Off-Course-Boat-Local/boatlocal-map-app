import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale, resolveLocale } from "./locales";
import { DICTIONARIES } from "./dictionaries";

describe("resolveLocale", () => {
  describe("cookie priority", () => {
    it("returns a valid cookie locale regardless of Accept-Language", () => {
      expect(resolveLocale("nl", "de-DE,de;q=0.9")).toBe("nl");
      expect(resolveLocale("es", "en-GB")).toBe("es");
    });

    it("accepts every supported locale from the cookie", () => {
      for (const locale of SUPPORTED_LOCALES) {
        expect(resolveLocale(locale, undefined)).toBe(locale);
      }
    });

    it("is case/whitespace tolerant for the cookie value", () => {
      expect(resolveLocale(" NL ", undefined)).toBe("nl");
      expect(resolveLocale("De", undefined)).toBe("de");
    });

    it("ignores an invalid cookie and falls through to Accept-Language", () => {
      expect(resolveLocale("it", "nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
      expect(resolveLocale("garbage!!", "de")).toBe("de");
      expect(resolveLocale("", "es-ES")).toBe("es");
    });
  });

  describe("Accept-Language parsing", () => {
    it("picks the highest q-value supported language", () => {
      expect(resolveLocale(undefined, "de;q=0.5,nl;q=0.9")).toBe("nl");
      expect(resolveLocale(undefined, "es;q=1,en;q=0.2")).toBe("es");
    });

    it("defaults q to 1 when omitted", () => {
      expect(resolveLocale(undefined, "nl,de;q=0.9")).toBe("nl");
      expect(resolveLocale(undefined, "de;q=0.9,nl")).toBe("nl");
    });

    it("matches on the base language: de-AT → de, nl-BE → nl, es-419 → es, fr-CA → fr", () => {
      expect(resolveLocale(undefined, "de-AT")).toBe("de");
      expect(resolveLocale(undefined, "nl-BE,fr-BE;q=0.9")).toBe("nl");
      expect(resolveLocale(undefined, "es-419")).toBe("es");
      expect(resolveLocale(undefined, "fr-CA")).toBe("fr");
      expect(resolveLocale(undefined, "en-GB,en-US;q=0.9")).toBe("en");
    });

    it("skips unsupported languages and takes the best supported one", () => {
      expect(resolveLocale(undefined, "it-IT,it;q=0.9,de;q=0.7,en;q=0.5")).toBe("de");
      expect(resolveLocale(undefined, "zh-CN,ja;q=0.9,es-MX;q=0.4")).toBe("es");
    });

    it("keeps header order among equal q-values", () => {
      expect(resolveLocale(undefined, "nl;q=0.8,de;q=0.8")).toBe("nl");
      expect(resolveLocale(undefined, "de;q=0.8,nl;q=0.8")).toBe("de");
    });

    it("treats q=0 as not acceptable", () => {
      expect(resolveLocale(undefined, "nl;q=0,de;q=0.5")).toBe("de");
      expect(resolveLocale(undefined, "nl;q=0")).toBe(DEFAULT_LOCALE);
    });

    it("ignores wildcards and whitespace", () => {
      expect(resolveLocale(undefined, "*")).toBe(DEFAULT_LOCALE);
      expect(resolveLocale(undefined, " * , nl ; q=0.3 ")).toBe("nl");
    });

    it("survives garbage q-values by treating them as 1", () => {
      expect(resolveLocale(undefined, "nl;q=banana,de;q=0.9")).toBe("nl");
    });
  });

  describe("fallback", () => {
    it("returns 'en' with no inputs at all", () => {
      expect(resolveLocale(undefined, undefined)).toBe("en");
    });

    it("returns 'en' for pure garbage in both inputs", () => {
      expect(resolveLocale("!!", ";;;,,,===")).toBe("en");
      expect(resolveLocale("xx", "pt-BR,it;q=0.8,12345")).toBe("en");
    });
  });
});

describe("isLocale", () => {
  it("accepts exactly the five supported codes", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("nl")).toBe(true);
    expect(isLocale("de")).toBe(true);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("it")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("dictionaries", () => {
  it("exist for every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(DICTIONARIES[locale]).toBeDefined();
    }
  });
});
