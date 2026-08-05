import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SAVED_PLACES_STORAGE_KEY,
  addSavedPlace,
  clearSavedPlaces,
  getSavedPlaceIds,
  isPlaceSaved,
  removeSavedPlace,
  subscribeSavedPlaces,
  toggleSavedPlace,
} from "./savedPlaces";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("getSavedPlaceIds", () => {
  it("is empty when nothing has ever been saved", () => {
    expect(getSavedPlaceIds()).toEqual([]);
  });

  it("ignores corrupt JSON rather than throwing", () => {
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, "{not json");
    expect(getSavedPlaceIds()).toEqual([]);
  });

  it("ignores a non-array value", () => {
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify({ oops: true }));
    expect(getSavedPlaceIds()).toEqual([]);
  });

  it("drops non-string entries and dedupes, preserving first-seen order", () => {
    window.localStorage.setItem(
      SAVED_PLACES_STORAGE_KEY,
      JSON.stringify(["a", 42, "b", "a", null, "c"]),
    );
    expect(getSavedPlaceIds()).toEqual(["a", "b", "c"]);
  });
});

describe("addSavedPlace / removeSavedPlace / isPlaceSaved", () => {
  it("adds an id and makes it read as saved", () => {
    expect(isPlaceSaved("sunset-canal")).toBe(false);
    const ids = addSavedPlace("sunset-canal");
    expect(ids).toEqual(["sunset-canal"]);
    expect(isPlaceSaved("sunset-canal")).toBe(true);
  });

  it("adding the same id twice does not duplicate it", () => {
    addSavedPlace("sunset-canal");
    const ids = addSavedPlace("sunset-canal");
    expect(ids).toEqual(["sunset-canal"]);
  });

  it("removes an id", () => {
    addSavedPlace("sunset-canal");
    addSavedPlace("bakers-roasters");
    const ids = removeSavedPlace("sunset-canal");
    expect(ids).toEqual(["bakers-roasters"]);
    expect(isPlaceSaved("sunset-canal")).toBe(false);
  });

  it("removing an id that isn't saved is a no-op", () => {
    addSavedPlace("bakers-roasters");
    const ids = removeSavedPlace("not-saved");
    expect(ids).toEqual(["bakers-roasters"]);
  });

  it("persists across a fresh read (survives 'reload')", () => {
    addSavedPlace("sunset-canal");
    expect(getSavedPlaceIds()).toEqual(["sunset-canal"]);
  });
});

describe("toggleSavedPlace", () => {
  it("saves an unsaved id and reports saved: true", () => {
    const result = toggleSavedPlace("sunset-canal");
    expect(result).toEqual({ ids: ["sunset-canal"], saved: true });
  });

  it("unsaves a saved id and reports saved: false", () => {
    addSavedPlace("sunset-canal");
    const result = toggleSavedPlace("sunset-canal");
    expect(result).toEqual({ ids: [], saved: false });
  });
});

describe("clearSavedPlaces", () => {
  it("empties the list", () => {
    addSavedPlace("a");
    addSavedPlace("b");
    expect(clearSavedPlaces()).toEqual([]);
    expect(getSavedPlaceIds()).toEqual([]);
  });
});

describe("subscribeSavedPlaces", () => {
  it("notifies same-tab listeners when a write happens", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeSavedPlaces(callback);

    addSavedPlace("sunset-canal");
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    addSavedPlace("bakers-roasters");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("notifies on a cross-tab storage event for the saved-places key", () => {
    const callback = vi.fn();
    subscribeSavedPlaces(callback);

    window.dispatchEvent(
      new StorageEvent("storage", { key: SAVED_PLACES_STORAGE_KEY, newValue: "[]" }),
    );
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores a cross-tab storage event for an unrelated key", () => {
    const callback = vi.fn();
    subscribeSavedPlaces(callback);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "some-other-app-key", newValue: "1" }),
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it("treats a null-key storage event (localStorage.clear() elsewhere) as a change", () => {
    const callback = vi.fn();
    subscribeSavedPlaces(callback);

    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
