import { describe, expect, it } from "vitest";

import { normalizeCampaignParams, previewCampaignBookingUrl } from "./campaignParams";

describe("normalizeCampaignParams", () => {
  it("returns empty string for blank/whitespace-only input", () => {
    expect(normalizeCampaignParams("")).toBe("");
    expect(normalizeCampaignParams("   ")).toBe("");
  });

  it("passes a bare query string through unchanged", () => {
    expect(normalizeCampaignParams("utm_source=lobby&utm_campaign=summer")).toBe(
      "utm_source=lobby&utm_campaign=summer",
    );
  });

  it("strips a leading ? or &", () => {
    expect(normalizeCampaignParams("?utm_source=lobby")).toBe("utm_source=lobby");
    expect(normalizeCampaignParams("&utm_source=lobby")).toBe("utm_source=lobby");
  });

  it("extracts just the query string from a full tracking URL", () => {
    expect(
      normalizeCampaignParams("https://boatlocal.nl/book?utm_source=lobby&utm_campaign=summer"),
    ).toBe("utm_source=lobby&utm_campaign=summer");
  });

  it("trims surrounding whitespace from a pasted value", () => {
    expect(normalizeCampaignParams("  utm_source=lobby  ")).toBe("utm_source=lobby");
  });
});

describe("previewCampaignBookingUrl", () => {
  it("shows the sample booking URL unchanged when there is nothing to merge", () => {
    expect(previewCampaignBookingUrl("")).toContain("boatlocal.nl/book");
    expect(new URL(previewCampaignBookingUrl("")).searchParams.has("utm_source")).toBe(false);
  });

  it("reflects real campaign params in the preview", () => {
    const preview = new URL(previewCampaignBookingUrl("utm_source=hotel-lobby"));
    expect(preview.searchParams.get("utm_source")).toBe("hotel-lobby");
  });

  it("never lets the preview's campaign params overwrite the attribution params already on the sample URL", () => {
    const preview = new URL(previewCampaignBookingUrl("ref=hijacked&tour=hijacked"));
    expect(preview.searchParams.get("ref")).toBe("bkl_example123");
    expect(preview.searchParams.get("tour")).toBe("sunset-canal");
  });
});
