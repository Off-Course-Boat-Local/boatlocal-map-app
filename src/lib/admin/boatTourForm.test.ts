import { describe, expect, it } from "vitest";

import { MAX_PHOTOS, NOTE_MAX_LENGTH, parseBoatTourForm } from "./boatTourForm";

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
  name: "Sunset Canal Cruise",
  area: "Central Station",
  lng: "4.9003",
  lat: "52.3791",
  meta: "90 min · €28 pp · drinks incl.",
  note: "My absolute favourite — book for golden hour.",
  bookingUrl: "https://boatlocal.nl/tours/sunset-canal-cruise",
};

describe("parseBoatTourForm — happy path", () => {
  it("parses a fully filled-out form", () => {
    const result = parseBoatTourForm(
      formData({
        ...validFields,
        photos: ["data:image/png;base64,aaa"],
        position: "3",
        status: "active",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value).toEqual({
      id: undefined,
      name: "Sunset Canal Cruise",
      area: "Central Station",
      lng: 4.9003,
      lat: 52.3791,
      meta: "90 min · €28 pp · drinks incl.",
      note: "My absolute favourite — book for golden hour.",
      bookingUrl: "https://boatlocal.nl/tours/sunset-canal-cruise",
      photos: ["data:image/png;base64,aaa"],
      position: 3,
      status: "active",
    });
  });

  it("carries the id through for edits", () => {
    const result = parseBoatTourForm(formData({ ...validFields, id: "boat-tour-1" }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.id).toBe("boat-tour-1");
  });

  it("defaults photos to an empty array, position to undefined, status to active when omitted", () => {
    const result = parseBoatTourForm(formData({ ...validFields }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.photos).toEqual([]);
    expect(result.value.position).toBeUndefined();
    expect(result.value.status).toBe("active");
  });

  it("treats status=hidden as hidden, and anything else as active", () => {
    const hidden = parseBoatTourForm(formData({ ...validFields, status: "hidden" }));
    const other = parseBoatTourForm(formData({ ...validFields, status: "nonsense" }));
    expect(hidden.ok && hidden.value.status).toBe("hidden");
    expect(other.ok && other.value.status).toBe("active");
  });

  it("caps photos at MAX_PHOTOS", () => {
    const photos = Array.from({ length: MAX_PHOTOS + 5 }, (_, i) => `data:image/png;base64,${i}`);
    const result = parseBoatTourForm(formData({ ...validFields, photos }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.photos).toHaveLength(MAX_PHOTOS);
  });
});

describe("parseBoatTourForm — validation failures", () => {
  it("rejects a missing name", () => {
    const result = parseBoatTourForm(formData({ ...validFields, name: "  " }));
    expect(result).toEqual({ ok: false, error: "Enter a tour name." });
  });

  it("rejects a missing area", () => {
    const result = parseBoatTourForm(formData({ ...validFields, area: "" }));
    expect(result).toEqual({ ok: false, error: "Enter a departure point / area." });
  });

  it("rejects a missing or non-numeric lng/lat", () => {
    expect(parseBoatTourForm(formData({ ...validFields, lng: "" })).ok).toBe(false);
    expect(parseBoatTourForm(formData({ ...validFields, lat: "abc" })).ok).toBe(false);
  });

  it("rejects an out-of-range lng/lat", () => {
    expect(parseBoatTourForm(formData({ ...validFields, lng: "200" })).ok).toBe(false);
    expect(parseBoatTourForm(formData({ ...validFields, lat: "-95" })).ok).toBe(false);
  });

  it("rejects a missing price/duration line (meta)", () => {
    const result = parseBoatTourForm(formData({ ...validFields, meta: "   " }));
    expect(result.ok).toBe(false);
  });

  it("rejects a missing description", () => {
    const result = parseBoatTourForm(formData({ ...validFields, note: "   " }));
    expect(result.ok).toBe(false);
  });

  it(`rejects a description longer than ${NOTE_MAX_LENGTH} characters`, () => {
    const result = parseBoatTourForm(
      formData({ ...validFields, note: "x".repeat(NOTE_MAX_LENGTH + 1) }),
    );
    expect(result).toEqual({
      ok: false,
      error: `Description must be ${NOTE_MAX_LENGTH} characters or fewer.`,
    });
  });

  it(`accepts a description exactly ${NOTE_MAX_LENGTH} characters long`, () => {
    const result = parseBoatTourForm(
      formData({ ...validFields, note: "x".repeat(NOTE_MAX_LENGTH) }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a missing booking URL", () => {
    const result = parseBoatTourForm(formData({ ...validFields, bookingUrl: "" }));
    expect(result).toEqual({ ok: false, error: "Enter the boatlocal.nl booking URL." });
  });

  it("rejects a malformed booking URL", () => {
    const result = parseBoatTourForm(formData({ ...validFields, bookingUrl: "not-a-url" }));
    expect(result).toEqual({ ok: false, error: "Booking URL must be a valid http(s) URL." });
  });

  it("rejects a non-http(s) booking URL", () => {
    const result = parseBoatTourForm(
      formData({ ...validFields, bookingUrl: "javascript:alert(1)" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-positive position", () => {
    expect(parseBoatTourForm(formData({ ...validFields, position: "0" })).ok).toBe(false);
    expect(parseBoatTourForm(formData({ ...validFields, position: "-1" })).ok).toBe(false);
    expect(parseBoatTourForm(formData({ ...validFields, position: "abc" })).ok).toBe(false);
  });
});
