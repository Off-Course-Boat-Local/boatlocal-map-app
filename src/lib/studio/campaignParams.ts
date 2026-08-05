// Pure helpers for Studio > Campaign (PRD §7.6). Dependency-free and
// side-effect-free on purpose — unit-testable without mocking cookies, the
// data source, or localStorage, and safe to import from either the Server
// Action (campaignActions.ts) or the Client Component (CampaignForm.tsx)
// that share this logic.

import { mergeCampaignParams } from "@/lib/boatBookingHandoff";

/**
 * Accepts whatever a founder pastes into the Campaign field — a bare query
 * string ("utm_source=..."), one with a leading "?"/"&", or a full tracking
 * URL — and normalises it to the raw query-string fragment
 * `CompanyRecord.campaignParams` expects (no leading punctuation), which is
 * exactly what gets merged onto every booking URL by
 * boatBookingHandoff.ts's mergeCampaignParams. Returns "" for empty/
 * whitespace-only input.
 */
export function normalizeCampaignParams(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).search.replace(/^\?/, "");
    } catch {
      // Not actually a valid URL despite the scheme — fall through and treat
      // it as a bare fragment instead of rejecting the input outright.
    }
  }

  return trimmed.replace(/^[?&]+/, "");
}

/** A representative booking URL, purely for rendering an honest "here's what
 * it'll look like" preview in Studio — never actually sent anywhere. */
const SAMPLE_BOOKING_URL = "https://boatlocal.nl/book?tour=sunset-canal&ref=bkl_example123";

/**
 * Shows exactly what mergeCampaignParams will do to a real booking URL, so
 * the Campaign page's preview can't drift from the real merge behaviour.
 */
export function previewCampaignBookingUrl(raw: string): string {
  return mergeCampaignParams(SAMPLE_BOOKING_URL, normalizeCampaignParams(raw));
}
