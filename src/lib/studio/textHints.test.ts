import { describe, expect, it } from "vitest";

import { cleanHint } from "./textHints";

// Regression test for a live bug (2026-09-01): gpt-4o-mini's structured
// output for `noteHint` occasionally returned the literal string "null"
// instead of the JSON null its schema allows, which then won the `||`
// fallback chain in src/app/api/studio/places/assistant/route.ts and
// showed up verbatim as a candidate's draft note.
describe("cleanHint", () => {
  it("treats a real value as-is", () => {
    expect(cleanHint("Great tapas, easy to walk in")).toBe("Great tapas, easy to walk in");
  });

  it("trims surrounding whitespace", () => {
    expect(cleanHint("  Great tapas  ")).toBe("Great tapas");
  });

  it("treats real null/undefined as null", () => {
    expect(cleanHint(null)).toBeNull();
    expect(cleanHint(undefined)).toBeNull();
  });

  it("treats an empty or whitespace-only string as null", () => {
    expect(cleanHint("")).toBeNull();
    expect(cleanHint("   ")).toBeNull();
  });

  it("treats the literal word 'null' (any case) as null — the regression case", () => {
    expect(cleanHint("null")).toBeNull();
    expect(cleanHint("NULL")).toBeNull();
    expect(cleanHint("  Null  ")).toBeNull();
  });

  it("treats other null-lookalikes as null", () => {
    expect(cleanHint("none")).toBeNull();
    expect(cleanHint("n/a")).toBeNull();
    expect(cleanHint("N/A")).toBeNull();
    expect(cleanHint("undefined")).toBeNull();
  });
});
