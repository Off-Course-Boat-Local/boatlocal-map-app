import { describe, expect, it } from "vitest";

import {
  getReviewOptions,
  placeholderGoogleSearchUrl,
  reviewClickEventType,
} from "./guestReview";

describe("getReviewOptions", () => {
  it("returns only Google when just googleReviewUrl is configured", () => {
    const options = getReviewOptions(
      { googleReviewUrl: "https://g.page/r/example/review", tripadvisorReviewUrl: null },
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

  it("returns only Tripadvisor when just tripadvisorReviewUrl is configured", () => {
    const options = getReviewOptions(
      { googleReviewUrl: null, tripadvisorReviewUrl: "https://tripadvisor.com/example" },
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

  it("returns Google first, then Tripadvisor, when both are configured", () => {
    const options = getReviewOptions(
      {
        googleReviewUrl: "https://g.page/r/example/review",
        tripadvisorReviewUrl: "https://tripadvisor.com/example",
      },
      "Boat & Bike Co.",
    );

    expect(options.map((o) => o.platform)).toEqual(["google", "tripadvisor"]);
    expect(options.every((o) => o.isPlaceholder === false)).toBe(true);
  });

  it("falls back to a single placeholder option when neither is configured", () => {
    const options = getReviewOptions(
      { googleReviewUrl: null, tripadvisorReviewUrl: null },
      "Boat & Bike Co.",
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ platform: "google", isPlaceholder: true });
    expect(options[0].url).toBe(placeholderGoogleSearchUrl("Boat & Bike Co."));
  });

  it("falls back to a placeholder when the company record itself is null", () => {
    const options = getReviewOptions(null, "Boat & Bike Co.");
    expect(options).toHaveLength(1);
    expect(options[0].isPlaceholder).toBe(true);
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
