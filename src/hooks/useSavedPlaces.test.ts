import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useSavedPlaces } from "./useSavedPlaces";

beforeEach(() => {
  window.localStorage.clear();
});

describe("useSavedPlaces", () => {
  it("starts empty when nothing was previously saved", () => {
    const { result } = renderHook(() => useSavedPlaces());
    expect(result.current.savedIds).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.isSaved("sunset-canal")).toBe(false);
  });

  it("save() adds an id and updates count/isSaved", () => {
    const { result } = renderHook(() => useSavedPlaces());

    act(() => result.current.save("sunset-canal"));

    expect(result.current.savedIds).toEqual(["sunset-canal"]);
    expect(result.current.count).toBe(1);
    expect(result.current.isSaved("sunset-canal")).toBe(true);
  });

  it("unsave() removes an id", () => {
    const { result } = renderHook(() => useSavedPlaces());

    act(() => result.current.save("sunset-canal"));
    act(() => result.current.unsave("sunset-canal"));

    expect(result.current.savedIds).toEqual([]);
    expect(result.current.isSaved("sunset-canal")).toBe(false);
  });

  it("toggle() flips saved state", () => {
    const { result } = renderHook(() => useSavedPlaces());

    act(() => result.current.toggle("sunset-canal"));
    expect(result.current.isSaved("sunset-canal")).toBe(true);

    act(() => result.current.toggle("sunset-canal"));
    expect(result.current.isSaved("sunset-canal")).toBe(false);
  });

  it("reflects a write made by a second hook instance in the same tab", () => {
    const a = renderHook(() => useSavedPlaces());
    const b = renderHook(() => useSavedPlaces());

    act(() => a.result.current.save("sunset-canal"));

    expect(b.result.current.savedIds).toEqual(["sunset-canal"]);
  });

  it("picks up a list already in localStorage from a previous visit", () => {
    window.localStorage.setItem(
      "boatlocal:saved-place-ids:v1",
      JSON.stringify(["bakers-roasters"]),
    );

    const { result } = renderHook(() => useSavedPlaces());
    expect(result.current.savedIds).toEqual(["bakers-roasters"]);
  });
});
