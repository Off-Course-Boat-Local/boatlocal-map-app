import { describe, expect, it } from "vitest";

import { darkenHex, isValidHexColor } from "./color";

describe("isValidHexColor", () => {
  it("accepts 3- and 6-digit hex, case-insensitively", () => {
    expect(isValidHexColor("#2B4FE0")).toBe(true);
    expect(isValidHexColor("#2b4fe0")).toBe(true);
    expect(isValidHexColor("#fff")).toBe(true);
    expect(isValidHexColor("#FFF")).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isValidHexColor("  #2B4FE0  ")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidHexColor("2B4FE0")).toBe(false); // missing '#'
    expect(isValidHexColor("#2B4FE")).toBe(false); // wrong length
    expect(isValidHexColor("#GGGGGG")).toBe(false); // not hex digits
    expect(isValidHexColor("blue")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("darkenHex", () => {
  it("returns a strictly darker colour for a mid-tone input", () => {
    const dark = darkenHex("#2B4FE0", 0.3);
    expect(isValidHexColor(dark)).toBe(true);
    // Every channel should be <= the original.
    expect(parseInt(dark.slice(1, 3), 16)).toBeLessThan(0x2b);
    expect(parseInt(dark.slice(3, 5), 16)).toBeLessThan(0x4f);
    expect(parseInt(dark.slice(5, 7), 16)).toBeLessThan(0xe0);
  });

  it("lands reasonably close to the hand-picked primaryDark of the seeded brands", () => {
    // src/lib/brand.ts BRANDS.coastal: primary #2B4FE0, primaryDark #1D37A8.
    const dark = darkenHex("#2B4FE0", 0.3);
    expect(dark).toBe("#1e379d");
  });

  it("expands 3-digit hex before darkening", () => {
    expect(darkenHex("#fff", 0.5)).toBe("#808080");
  });

  it("never goes below #000000", () => {
    expect(darkenHex("#000000", 0.9)).toBe("#000000");
  });

  it("returns the input unchanged when it is not a valid hex colour", () => {
    expect(darkenHex("not-a-colour")).toBe("not-a-colour");
    expect(darkenHex("")).toBe("");
  });

  it("defaults amount to 0.3 when omitted", () => {
    expect(darkenHex("#2B4FE0")).toBe(darkenHex("#2B4FE0", 0.3));
  });
});
