import { describe, expect, it } from "vitest";

import {
  MAX_PHOTOS,
  NOTE_MAX_LENGTH,
  RECOMMENDATION_CATEGORIES,
  parseRecommendationForm,
} from "./recommendationForm";

function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

const validFields = {
  name: "Café de Jaren",
  categories: ["coffee"],
  area: "Centrum",
  address: "Nieuwe Doelenstraat 20",
  lng: "4.8965",
  lat: "52.3676",
  note: "My favourite spot for a flat white by the water.",
  hours: "Daily 9:00–20:00",
};

describe("RECOMMENDATION_CATEGORIES", () => {
  it("never includes boats — boat tours are a separate table/tab", () => {
    expect(RECOMMENDATION_CATEGORIES.some((c) => c.id === "boats")).toBe(false);
  });

  it("includes every other fixed category", () => {
    expect(RECOMMENDATION_CATEGORIES.map((c) => c.id).sort()).toEqual(
      [
        "breakfast",
        "coffee",
        "dancing",
        "dinner",
        "drinks",
        "lunch",
        "photo",
        "see",
        "shop",
        "wine",
      ].sort(),
    );
  });
});

describe("parseRecommendationForm — happy path", () => {
  it("parses a fully filled-out form", () => {
    const result = parseRecommendationForm(
      formData({ ...validFields, photos: ["data:image/png;base64,aaa"], visible: "on" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value).toEqual({
      id: undefined,
      categories: ["coffee"],
      name: "Café de Jaren",
      area: "Centrum",
      address: "Nieuwe Doelenstraat 20",
      lng: 4.8965,
      lat: 52.3676,
      note: "My favourite spot for a flat white by the water.",
      hours: "Daily 9:00–20:00",
      photos: ["data:image/png;base64,aaa"],
      visible: true,
    });
  });

  it("carries the id through for edits", () => {
    const result = parseRecommendationForm(formData({ ...validFields, id: "rec-1" }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.id).toBe("rec-1");
  });

  it("treats an absent visible checkbox as false, and present (any value) as true", () => {
    const unchecked = parseRecommendationForm(formData({ ...validFields }));
    const checked = parseRecommendationForm(formData({ ...validFields, visible: "on" }));
    expect(unchecked.ok && unchecked.value.visible).toBe(false);
    expect(checked.ok && checked.value.visible).toBe(true);
  });

  it("defaults photos to an empty array and hours to empty string when omitted", () => {
    const { name, categories, area, address, lng, lat, note } = validFields;
    const result = parseRecommendationForm(
      formData({ name, categories, area, address, lng, lat, note }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.photos).toEqual([]);
    expect(result.value.hours).toBe("");
  });

  it("caps photos at MAX_PHOTOS", () => {
    const photos = Array.from({ length: MAX_PHOTOS + 5 }, (_, i) => `data:image/png;base64,${i}`);
    const result = parseRecommendationForm(formData({ ...validFields, photos }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.photos).toHaveLength(MAX_PHOTOS);
  });
});

describe("parseRecommendationForm — validation failures", () => {
  it("rejects a missing name", () => {
    const result = parseRecommendationForm(formData({ ...validFields, name: "  " }));
    expect(result).toEqual({ ok: false, error: "Enter a name." });
  });

  it("rejects an unrecognised category — filtered out, leaving none selected", () => {
    const result = parseRecommendationForm(formData({ ...validFields, categories: ["nonsense"] }));
    expect(result).toEqual({ ok: false, error: "Choose at least one category." });
  });

  it("rejects no categories selected at all", () => {
    const result = parseRecommendationForm(formData({ ...validFields, categories: [] }));
    expect(result).toEqual({ ok: false, error: "Choose at least one category." });
  });

  it("'boats' is never offered as a selectable category — RECOMMENDATION_CATEGORIES excludes it, so it's silently filtered like any other unrecognised value", () => {
    const result = parseRecommendationForm(formData({ ...validFields, categories: ["boats"] }));
    expect(result).toEqual({ ok: false, error: "Choose at least one category." });
  });

  it("keeps multiple valid categories, in the order checked", () => {
    const result = parseRecommendationForm(
      formData({ ...validFields, categories: ["drinks", "coffee"] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.categories).toEqual(["drinks", "coffee"]);
  });

  it("rejects a missing area", () => {
    const result = parseRecommendationForm(formData({ ...validFields, area: "" }));
    expect(result).toEqual({ ok: false, error: "Enter an area or neighbourhood." });
  });

  it("rejects a missing address", () => {
    const result = parseRecommendationForm(formData({ ...validFields, address: "" }));
    expect(result).toEqual({ ok: false, error: "Enter an address." });
  });

  it("rejects a missing or non-numeric lng/lat", () => {
    expect(parseRecommendationForm(formData({ ...validFields, lng: "" })).ok).toBe(false);
    expect(parseRecommendationForm(formData({ ...validFields, lat: "abc" })).ok).toBe(false);
  });

  it("rejects an out-of-range lng/lat", () => {
    expect(parseRecommendationForm(formData({ ...validFields, lng: "200" })).ok).toBe(false);
    expect(parseRecommendationForm(formData({ ...validFields, lat: "-95" })).ok).toBe(false);
  });

  it("rejects a missing note — the note is the whole endorsement", () => {
    const result = parseRecommendationForm(formData({ ...validFields, note: "   " }));
    expect(result.ok).toBe(false);
  });

  it(`rejects a note longer than ${NOTE_MAX_LENGTH} characters`, () => {
    const result = parseRecommendationForm(
      formData({ ...validFields, note: "x".repeat(NOTE_MAX_LENGTH + 1) }),
    );
    expect(result).toEqual({
      ok: false,
      error: `Note must be ${NOTE_MAX_LENGTH} characters or fewer.`,
    });
  });

  it(`accepts a note exactly ${NOTE_MAX_LENGTH} characters long`, () => {
    const result = parseRecommendationForm(
      formData({ ...validFields, note: "x".repeat(NOTE_MAX_LENGTH) }),
    );
    expect(result.ok).toBe(true);
  });
});
