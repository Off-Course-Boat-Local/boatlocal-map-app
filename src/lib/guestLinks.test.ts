import { describe, expect, it } from "vitest";

import { guestQueryString, withGuestQuery } from "./guestLinks";

describe("guestQueryString", () => {
  it("returns an empty string when nothing is given", () => {
    expect(guestQueryString()).toBe("");
    expect(guestQueryString(undefined)).toBe("");
  });

  it("returns an empty string for an empty object", () => {
    expect(guestQueryString({})).toBe("");
  });

  it("passes a real URLSearchParams through unchanged", () => {
    expect(guestQueryString(new URLSearchParams("company=coral&guide=jan"))).toBe(
      "company=coral&guide=jan",
    );
  });

  it("serialises a Next.js-style plain object", () => {
    expect(guestQueryString({ company: "forest", guide: "maria" })).toBe(
      "company=forest&guide=maria",
    );
  });

  it("skips null/undefined values", () => {
    expect(guestQueryString({ company: "ink", guide: undefined })).toBe("company=ink");
  });

  it("repeats a key for each entry of an array value", () => {
    const qs = guestQueryString({ tag: ["a", "b"] });
    expect(new URLSearchParams(qs).getAll("tag")).toEqual(["a", "b"]);
  });
});

describe("withGuestQuery", () => {
  it("returns the plain path when there is no query string", () => {
    expect(withGuestQuery("/map", "")).toBe("/map");
  });

  it("appends the query string with a single '?'", () => {
    expect(withGuestQuery("/map", "company=coral&guide=jan")).toBe(
      "/map?company=coral&guide=jan",
    );
  });
});
