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
 * Official BoatLocal Google Review direct deep link (Place ID: ChIJB5GUHB4JxkcRLsceJ5ywwYo).
 * Used by default when a company has not configured their own Google Review URL,
 * ensuring guest reviews naturally flow to BoatLocal.
 */
export const DEFAULT_BOATLOCAL_GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJB5GUHB4JxkcRLsceJ5ywwYo";

/**
 * Key-free Google search deep link (no Places API, no Maps JS API, no API
 * key — see src/lib/mapsHandoff.ts for the same pattern used for
 * directions).
 */
export function placeholderGoogleSearchUrl(companyName: string): string {
  const params = new URLSearchParams({ q: `${companyName} reviews` });
  return `https://www.google.com/search?${params.toString()}`;
}

/**
 * Builds the (single) public review option to show — one link, never a
 * choice between competing review sites (founder call, 2026-09-01). Which
 * platform is `company.reviewPlatform` (Studio's "Review links" section):
 * 1. "tripadvisor": uses `tripadvisorReviewUrl` if the company has actually
 *    configured one; a platform picked with no URL set is a misconfigured
 *    state, not a broken link, so this falls back to the Google case below.
 * 2. "google" (the default, and the tripadvisor fallback): uses the
 *    company's own `googleReviewUrl` if configured, otherwise BoatLocal's
 *    own official direct Google review URL (`DEFAULT_BOATLOCAL_GOOGLE_REVIEW_URL`)
 *    — flagged `isPlaceholder` so the UI can say so, since that's someone
 *    else's listing, not this company's.
 *
 * Returns an array (rather than a single option) only because
 * GuestReviewScreen renders `reviewOptions.map(...)` — always length 1.
 */
export function getReviewOptions(
  company: Pick<CompanyRecord, "googleReviewUrl" | "tripadvisorReviewUrl" | "reviewPlatform"> | null,
  companyName: string,
): ReviewOption[] {
  if (company?.reviewPlatform === "tripadvisor" && company.tripadvisorReviewUrl) {
    return [
      {
        platform: "tripadvisor",
        label: "Tripadvisor",
        url: company.tripadvisorReviewUrl,
        isPlaceholder: false,
      },
    ];
  }

  return [
    {
      platform: "google",
      label: "Google",
      url: company?.googleReviewUrl || DEFAULT_BOATLOCAL_GOOGLE_REVIEW_URL,
      isPlaceholder: !company?.googleReviewUrl,
    },
  ];
}

/** Event type fired when a guest taps through to a given public review platform. */
export function reviewClickEventType(
  platform: ReviewPlatform,
): "review_click_google" | "review_click_tripadvisor" {
  return platform === "google" ? "review_click_google" : "review_click_tripadvisor";
}
