import { describe, expect, it } from "vitest";

import { normalizeWebsiteDomain } from "./websiteDomain";

describe("normalizeWebsiteDomain", () => {
  it("strips protocol, www, path, and query", () => {
    expect(normalizeWebsiteDomain("https://www.360amsterdamtours.com/tours?ref=1")).toBe("360amsterdamtours.com");
  });

  it("passes through an already-bare domain unchanged", () => {
    expect(normalizeWebsiteDomain("360amsterdamtours.com")).toBe("360amsterdamtours.com");
  });

  it("lowercases", () => {
    expect(normalizeWebsiteDomain("HotelVNesplein.COM")).toBe("hotelvnesplein.com");
  });

  it("returns null for blank/missing input", () => {
    expect(normalizeWebsiteDomain(null)).toBeNull();
    expect(normalizeWebsiteDomain(undefined)).toBeNull();
    expect(normalizeWebsiteDomain("")).toBeNull();
    expect(normalizeWebsiteDomain("   ")).toBeNull();
  });

  it("strips a trailing slash with no path", () => {
    expect(normalizeWebsiteDomain("https://example.com/")).toBe("example.com");
  });
});
