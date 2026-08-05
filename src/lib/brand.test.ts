import { describe, expect, it } from "vitest";

import { BRANDS, brandCssVars } from "./brand";
import { CATEGORIES } from "./categories";

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Perceptual-ish distance. Good enough to catch "these look the same". */
function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastWithWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

describe("brand tokens", () => {
  it("exposes every brand colour as a CSS custom property", () => {
    for (const brand of Object.values(BRANDS)) {
      const vars = brandCssVars(brand);
      expect(vars["--brand-primary"]).toBe(brand.primary);
      expect(vars["--brand-accent"]).toBe(brand.accent);
      expect(vars["--brand-surround"]).toBe(brand.surround);
    }
  });

  it("uses valid 6-digit hex everywhere", () => {
    for (const brand of Object.values(BRANDS)) {
      for (const key of ["primary", "primaryDark", "accent", "surround"] as const) {
        expect(brand[key], `${brand.id}.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("keeps white text legible on every brand primary", () => {
    // The header, the active filter pill and the "Book this tour" button all
    // put white on brand primary. 4.5:1 is the WCAG AA threshold for text.
    for (const brand of Object.values(BRANDS)) {
      expect(
        contrastWithWhite(brand.primary),
        `${brand.id} primary ${brand.primary}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("category colours vs brand colours", () => {
  // Regression test for a real bug: `boats` was once byte-identical to the
  // coastal brand primary, so for the flagship tenant the category colour
  // stopped carrying any information at all.
  //
  // The threshold here is deliberately low. Category colour and brand colour
  // occupy different regions — pins on the map vs the header, the active pill
  // and the CTA — so they do not need to be *far* apart, only far enough that
  // a guest can tell the pin's colour is saying something the chrome isn't.
  // A stricter rule sounds safer but is unsatisfiable: 8 categories and 5
  // brands all dark enough to carry a white glyph do not fit in that much
  // colour space, and forcing it produces a worse palette than the problem
  // it prevents.
  it("keeps every category from colliding with a brand primary", () => {
    const MIN_DISTANCE = 25;
    for (const category of CATEGORIES) {
      for (const brand of Object.values(BRANDS)) {
        const distance = colorDistance(category.color, brand.primary);
        expect(
          distance,
          `category "${category.id}" (${category.color}) vs brand "${brand.id}" (${brand.primary}) — distance ${distance.toFixed(0)}`,
        ).toBeGreaterThan(MIN_DISTANCE);
      }
    }
  });

  it("keeps categories distinguishable from each other at pin size", () => {
    // This is the constraint that actually matters: a guest reads the map by
    // pin colour. Three adjacent oranges collapse into one at 36px and push
    // all the work onto the glyph, which is far too small to carry it.
    const MIN_DISTANCE = 45;
    for (let i = 0; i < CATEGORIES.length; i++) {
      for (let j = i + 1; j < CATEGORIES.length; j++) {
        const a = CATEGORIES[i];
        const b = CATEGORIES[j];
        const distance = colorDistance(a.color, b.color);
        expect(
          distance,
          `"${a.id}" (${a.color}) vs "${b.id}" (${b.color}) — distance ${distance.toFixed(0)}`,
        ).toBeGreaterThan(MIN_DISTANCE);
      }
    }
  });

  it("keeps the white pin glyph legible on every category fill", () => {
    // 3:1 is the WCAG threshold for non-text graphics.
    for (const category of CATEGORIES) {
      expect(
        contrastWithWhite(category.color),
        `${category.id} ${category.color}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives every category a unique id, label and glyph", () => {
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
    expect(new Set(CATEGORIES.map((c) => c.label)).size).toBe(CATEGORIES.length);
    expect(new Set(CATEGORIES.map((c) => c.glyph)).size).toBe(CATEGORIES.length);
  });
});
