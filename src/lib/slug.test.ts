import { describe, expect, it } from "vitest";

import { RESERVED_SUBDOMAINS, initialFromName, isUrlSafeSubdomain, slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a plain name", () => {
    expect(slugify("Jan")).toBe("jan");
    expect(slugify("Anne Marie")).toBe("anne-marie");
  });

  it("strips diacritics", () => {
    expect(slugify("Marie-Ève")).toBe("marie-eve");
    expect(slugify("José")).toBe("jose");
  });

  it("collapses punctuation and trims leading/trailing hyphens", () => {
    expect(slugify("O'Brien & Co.")).toBe("o-brien-co");
    expect(slugify("  --Jan--  ")).toBe("jan");
  });

  it("falls back to 'guide' for input with no latin letters", () => {
    expect(slugify("")).toBe("guide");
    expect(slugify("   ")).toBe("guide");
    expect(slugify("😀😀")).toBe("guide");
  });
});

describe("uniqueSlug", () => {
  it("returns the plain slug when it is free", () => {
    expect(uniqueSlug("Jan", [])).toBe("jan");
    expect(uniqueSlug("Jan", ["maria"])).toBe("jan");
  });

  it("appends -2 when the base slug is taken", () => {
    expect(uniqueSlug("Jan", ["jan"])).toBe("jan-2");
  });

  it("keeps incrementing until a free slug is found", () => {
    expect(uniqueSlug("Jan", ["jan", "jan-2", "jan-3"])).toBe("jan-4");
  });

  it("accepts a Set directly", () => {
    expect(uniqueSlug("Jan", new Set(["jan"]))).toBe("jan-2");
  });
});

describe("initialFromName", () => {
  it("uppercases the first letter", () => {
    expect(initialFromName("jan")).toBe("J");
    expect(initialFromName("Maria")).toBe("M");
  });

  it("skips leading whitespace", () => {
    expect(initialFromName("  Jan")).toBe("J");
  });

  it("falls back to '?' for input with no letters or digits", () => {
    expect(initialFromName("")).toBe("?");
    expect(initialFromName("😀")).toBe("?");
  });
});

describe("isUrlSafeSubdomain", () => {
  it("accepts lowercase letters, digits and interior hyphens", () => {
    expect(isUrlSafeSubdomain("hotelv")).toBe(true);
    expect(isUrlSafeSubdomain("hotel-v")).toBe(true);
    expect(isUrlSafeSubdomain("hotel2")).toBe(true);
    expect(isUrlSafeSubdomain("a")).toBe(true);
  });

  it("rejects uppercase, spaces, and other punctuation", () => {
    expect(isUrlSafeSubdomain("Hotel V")).toBe(false);
    expect(isUrlSafeSubdomain("hotel_v")).toBe(false);
    expect(isUrlSafeSubdomain("hotel.v")).toBe(false);
    expect(isUrlSafeSubdomain("")).toBe(false);
  });

  it("rejects a leading or trailing hyphen", () => {
    expect(isUrlSafeSubdomain("-hotelv")).toBe(false);
    expect(isUrlSafeSubdomain("hotelv-")).toBe(false);
  });

  it("rejects a label over 63 characters", () => {
    expect(isUrlSafeSubdomain("a".repeat(63))).toBe(true);
    expect(isUrlSafeSubdomain("a".repeat(64))).toBe(false);
  });
});

describe("RESERVED_SUBDOMAINS", () => {
  it("reserves the platform's own fixed hosts", () => {
    expect(RESERVED_SUBDOMAINS.has("admin")).toBe(true);
    expect(RESERVED_SUBDOMAINS.has("studio")).toBe(true);
    expect(RESERVED_SUBDOMAINS.has("hotelv")).toBe(false);
  });
});
