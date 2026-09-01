import { describe, expect, it } from "vitest";

import {
  DEFAULT_BOATLOCAL_GOOGLE_REVIEW_URL,
  getReviewOptions,
  placeholderGoogleSearchUrl,
  reviewClickEventType,
} from "./guestReview";

describe("getReviewOptions", () => {
  it("always returns exactly one option — never a choice between platforms", () => {
    const options = getReviewOptions(
      {
        googleReviewUrl: "https://g.page/r/example/review",
        tripadvisorReviewUrl: "https://tripadvisor.com/example",
        reviewPlatform: "google",
      },
      "Boat & Bike Co.",
    );
    expect(options).toHaveLength(1);
  });

  it("returns Google when reviewPlatform is google and googleReviewUrl is configured", () => {
    const options = getReviewOptions(
      {
        googleReviewUrl: "https://g.page/r/example/review",
        tripadvisorReviewUrl: "https://tripadvisor.com/example",
        reviewPlatform: "google",
      },
      "Boat & Bike Co.",
    );

    expect(options).toEqual([
      {
        platform: "google",
        label: "Google",
        url: "https://g.page/r/example/review",
        isPlaceholder: false,
      },
    ]);
  });

  it("returns Tripadvisor when reviewPlatform is tripadvisor and tripadvisorReviewUrl is configured", () => {
    const options = getReviewOptions(
      {
        googleReviewUrl: "https://g.page/r/example/review",
        tripadvisorReviewUrl: "https://tripadvisor.com/example",
        reviewPlatform: "tripadvisor",
      },
      "Boat & Bike Co.",
    );

    expect(options).toEqual([
      {
        platform: "tripadvisor",
        label: "Tripadvisor",
        url: "https://tripadvisor.com/example",
        isPlaceholder: false,
      },
    ]);
  });

  it("falls back to Google when reviewPlatform is tripadvisor but no tripadvisorReviewUrl is set — a misconfigured pick, not a broken link", () => {
    const options = getReviewOptions(
      {
        googleReviewUrl: "https://g.page/r/example/review",
        tripadvisorReviewUrl: null,
        reviewPlatform: "tripadvisor",
      },
      "Boat & Bike Co.",
    );

    expect(options).toEqual([
      {
        platform: "google",
        label: "Google",
        url: "https://g.page/r/example/review",
        isPlaceholder: false,
      },
    ]);
  });

  it("flags isPlaceholder when Google falls back to BoatLocal's own review URL", () => {
    const options = getReviewOptions(
      { googleReviewUrl: null, tripadvisorReviewUrl: null, reviewPlatform: "google" },
      "Boat & Bike Co.",
    );

    expect(options).toEqual([
      {
        platform: "google",
        label: "Google",
        url: DEFAULT_BOATLOCAL_GOOGLE_REVIEW_URL,
        isPlaceholder: true,
      },
    ]);
  });

  it("defaults Google to BoatLocal official review URL when company record is null", () => {
    const options = getReviewOptions(null, "Boat & Bike Co.");
    expect(options).toEqual([
      {
        platform: "google",
        label: "Google",
        url: DEFAULT_BOATLOCAL_GOOGLE_REVIEW_URL,
        isPlaceholder: true,
      },
    ]);
  });

  it("never returns an empty list", () => {
    expect(getReviewOptions(null, "Anyone").length).toBeGreaterThan(0);
  });
});

describe("placeholderGoogleSearchUrl", () => {
  it("builds a key-free Google search URL for the company's reviews", () => {
    const url = placeholderGoogleSearchUrl("Boat & Bike Co.");
    expect(url.startsWith("https://www.google.com/search?")).toBe(true);
    expect(new URL(url).searchParams.get("q")).toBe("Boat & Bike Co. reviews");
  });

  it("never contains an API key parameter", () => {
    const url = placeholderGoogleSearchUrl("Anyone's Tours");
    expect(url).not.toMatch(/key=/i);
  });
});

describe("reviewClickEventType", () => {
  it("maps google -> review_click_google", () => {
    expect(reviewClickEventType("google")).toBe("review_click_google");
  });

  it("maps tripadvisor -> review_click_tripadvisor", () => {
    expect(reviewClickEventType("tripadvisor")).toBe("review_click_tripadvisor");
  });
});
