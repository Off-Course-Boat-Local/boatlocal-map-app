import { describe, expect, it } from "vitest";

import { ALL_PINS, BOAT_TOURS, PLACES } from "./data";
import { CATEGORY_MAP } from "./categories";

/** Generous bounding box around greater Amsterdam. */
const BBOX = { minLng: 4.72, maxLng: 5.02, minLat: 52.28, maxLat: 52.44 };

describe("recommendation data", () => {
  it("puts every pin inside Amsterdam", () => {
    // Catches the classic mistakes: swapped lng/lat, a dropped decimal.
    for (const pin of ALL_PINS) {
      expect(pin.lng, `${pin.name} lng`).toBeGreaterThan(BBOX.minLng);
      expect(pin.lng, `${pin.name} lng`).toBeLessThan(BBOX.maxLng);
      expect(pin.lat, `${pin.name} lat`).toBeGreaterThan(BBOX.minLat);
      expect(pin.lat, `${pin.name} lat`).toBeLessThan(BBOX.maxLat);
    }
  });

  it("uses only known categories", () => {
    for (const pin of ALL_PINS) {
      expect(CATEGORY_MAP[pin.category], `${pin.name}`).toBeDefined();
    }
  });

  it("gives every pin a unique id", () => {
    expect(new Set(ALL_PINS.map((p) => p.id)).size).toBe(ALL_PINS.length);
  });

  it("gives every place a guide note that reads like a person wrote it", () => {
    // The note is what we chose *instead of* a star rating. An empty or
    // one-word note means the place is doing no persuading at all.
    for (const place of PLACES) {
      expect(place.note.trim().length, place.name).toBeGreaterThan(20);
      expect(place.note.trim().split(/\s+/).length, place.name).toBeGreaterThan(4);
    }
  });

  it("gives every place guide-entered opening hours", () => {
    // Free text, by design — "closed Mondays" beats an empty hours table.
    for (const place of PLACES) {
      expect(place.hours.trim().length, place.name).toBeGreaterThan(0);
    }
  });

  it("gives every pin at least one photo", () => {
    // A card with no image is the one state that makes a guide look lazy.
    for (const pin of ALL_PINS) {
      expect(pin.photos.length, pin.name).toBeGreaterThanOrEqual(1);
    }
  });

  it("carries no rating field anywhere", () => {
    // Deliberate product decision: crowd ratings undercut the guide's
    // endorsement and push guests toward high-volume tourist traps. If a
    // rating ever reappears in the model, this should fail loudly.
    const serialised = JSON.stringify(ALL_PINS);
    for (const banned of ["rating", "userRatingCount", "reviewCount", "stars"]) {
      expect(serialised.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});

describe("boat tours", () => {
  it("meets the PRD minimum of six tours", () => {
    expect(BOAT_TOURS.length).toBeGreaterThanOrEqual(6);
  });

  it("gives every tour a boatlocal.nl booking URL", () => {
    for (const tour of BOAT_TOURS) {
      const url = new URL(tour.bookingUrl);
      expect(url.hostname, tour.name).toContain("boatlocal.nl");
    }
  });

  it("has a unique, gapless ordering", () => {
    const positions = BOAT_TOURS.map((t) => t.position).sort((a, b) => a - b);
    expect(new Set(positions).size).toBe(positions.length);
    expect(positions).toEqual(positions.map((_, i) => i + 1));
  });

  it("categorises every tour as a boat and flags it as such", () => {
    const boatPins = ALL_PINS.filter((p) => p.isBoat);
    expect(boatPins.length).toBe(BOAT_TOURS.length);
    for (const pin of boatPins) {
      expect(pin.category).toBe("boats");
      expect(pin.bookingUrl, pin.name).toBeTruthy();
    }
  });

  it("puts boats first, so they are never buried", () => {
    // The business model rests on the boat tour being visible without the
    // guest hunting for it. First in the list is not an accident.
    expect(ALL_PINS[0].isBoat).toBe(true);
  });
});
