// Pure helpers for the guest Review screen (PRD §5.6).
//
// HARD RULE: reviews are two SEPARATE flows. This module only concerns
// itself with (a) — the company's own public review link(s) — never the
// separate, out-of-scope boat-tour review flow. See
// src/app/(guest)/review/page.tsx for the full rule text.
//
// Kept framework-free (no React, no next/headers) so it is trivially unit
// testable and safely importable from both the server page and, if ever
// needed, a client component.

import type { CompanyRecord } from "./data/types";

export type ReviewPlatform = "google" | "tripadvisor";

export interface ReviewOption {
  platform: ReviewPlatform;
  label: string;
  url: string;
  /**
   * True when the company has not configured this platform's link yet and
   * this is a hardcoded fallback rather than a real, guide/company-entered
   * URL. Surfaced in the UI as a visible "not yet set up" notice — never
   * silently swapped in as if it were real.
   */
  isPlaceholder: boolean;
}

/**
 * Key-free Google search deep link (no Places API, no Maps JS API, no API
 * key — see src/lib/mapsHandoff.ts for the same pattern used for
 * directions). Used only as a last-resort placeholder when a company has
 * configured neither googleReviewUrl nor tripadvisorReviewUrl, so the
 * screen never renders with zero ways forward.
 *
 * TODO: once every company is required to configure at least one review
 * link in Studio (src/lib/data/source.ts's updateCompanyBranding), this
 * fallback can be removed entirely.
 */
export function placeholderGoogleSearchUrl(companyName: string): string {
  const params = new URLSearchParams({ q: `${companyName} reviews` });
  return `https://www.google.com/search?${params.toString()}`;
}

/**
 * Builds the list of public review options to show, in priority order
 * (Google, then Tripadvisor), reading straight from the fields the data
 * schema already has (`CompanyRecord.googleReviewUrl` /
 * `.tripadvisorReviewUrl`). Only includes a platform the company has
 * actually configured; if the company has configured neither, returns a
 * single hardcoded placeholder rather than an empty list.
 */
export function getReviewOptions(
  company: Pick<CompanyRecord, "googleReviewUrl" | "tripadvisorReviewUrl"> | null,
  companyName: string,
): ReviewOption[] {
  const options: ReviewOption[] = [];

  if (company?.googleReviewUrl) {
    options.push({
      platform: "google",
      label: "Google",
      url: company.googleReviewUrl,
      isPlaceholder: false,
    });
  }

  if (company?.tripadvisorReviewUrl) {
    options.push({
      platform: "tripadvisor",
      label: "Tripadvisor",
      url: company.tripadvisorReviewUrl,
      isPlaceholder: false,
    });
  }

  if (options.length === 0) {
    options.push({
      platform: "google",
      label: "Google",
      url: placeholderGoogleSearchUrl(companyName),
      isPlaceholder: true,
    });
  }

  return options;
}

/** Event type fired when a guest taps through to a given public review platform. */
export function reviewClickEventType(
  platform: ReviewPlatform,
): "review_click_google" | "review_click_tripadvisor" {
  return platform === "google" ? "review_click_google" : "review_click_tripadvisor";
}
