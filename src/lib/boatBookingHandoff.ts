// Turns the Boats-filter date + guest-count picker's selection
// (src/components/guest/BoatBookingPicker.tsx) into the booking hand-off URL
// a guest is redirected to from "Book this tour"
// (src/components/guest/GuestMapScreen.tsx).
//
// The actual URL building and click-id minting are NOT reimplemented here —
// that is exactly one implementation, in src/lib/attribution.ts
// (buildBookingUrl / createClickId), per this project's "booking handoff"
// house rule. buildBookingUrl appends tracking params onto the tour's own
// bookingUrl (BoatTourRecord.bookingUrl, sourced from BoatLocal's catalogue
// feed — see docs/attribution.md) rather than a fixed global base; this
// module's whole job is turning picker state — a `Date | null` and a guest
// count — into the already-typed params that function expects, plus
// threading that bookingUrl through from whichever tour is being booked.

import { buildBookingUrl, createClickId } from "./attribution";

export interface BoatBookingSelection {
  date: Date | null;
  guests: number;
}

/** What a boat pin's booking flow starts from before the guest has touched
 * the picker — no date, a party of two. Booking with no pre-filled trip
 * details is a fully supported path (see buildBoatBookingHandoff), not an
 * error state; this is just a sensible starting point for the stepper. */
export const DEFAULT_BOAT_BOOKING_SELECTION: BoatBookingSelection = {
  date: null,
  guests: 2,
};

/** YYYY-MM-DD in local time — the exact shape buildBookingUrl's `date` param expects. */
export function formatBookingDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Short human-readable label for the "Trip details" summary chip, e.g.
 * "Thu, Aug 20". Locale pinned to "en-US" so it can't vary with the guest's
 * device locale or the test environment's — this is a display label, not
 * data, so there is nothing lost by fixing it.
 */
export function formatBookingDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export interface BuildBoatBookingHandoffInput {
  /**
   * The tour's own boatlocal.nl page (BoatTourRecord.bookingUrl) — BoatLocal
   * returns this ready-to-use per cruise, and buildBookingUrl appends
   * tracking params onto it directly rather than building a URL from a
   * fixed base + tour id (see attribution.ts's header comment for why).
   */
  bookingUrl: string;
  selection: BoatBookingSelection;
  companySlug?: string;
  guideSlug?: string;
  /** Injectable so tests (and any future caller that wants to log the id
   * before opening the URL) get a deterministic value instead of a fresh
   * random one every call. Defaults to attribution.ts's createClickId(). */
  clickId?: string;
  /**
   * A tenant's campaign query-string fragment, set once in Studio > Campaign
   * (PRD §7.6; `CompanyRecord.campaignParams`) and meant to auto-propagate to
   * every booking button. Optional and purely additive — omitted (or falsy),
   * behaviour is byte-for-byte what it was before this field existed, so no
   * existing caller/test needed to change. See mergeCampaignParams below for
   * the actual merge, which never lets a campaign param overwrite one
   * buildBookingUrl already set (tour/ref/date/guests/company/guide).
   */
  campaignParams?: string | null;
}

export interface BoatBookingHandoff {
  url: string;
  clickId: string;
}

/**
 * Folds a campaign query-string fragment onto an already-built URL, without
 * overwriting any param that URL already has — campaign tracking is
 * additive, never allowed to clobber attribution data. Exported so Studio's
 * Campaign page (src/app/studio/campaign) can reuse it to render a truthful
 * "here's what a booking link will look like" preview instead of
 * re-implementing the merge rule there.
 */
export function mergeCampaignParams(url: string, campaignParams?: string | null): string {
  if (!campaignParams) return url;
  const merged = new URL(url);
  const extra = new URLSearchParams(campaignParams);
  for (const [key, value] of extra) {
    if (!merged.searchParams.has(key)) {
      merged.searchParams.set(key, value);
    }
  }
  return merged.toString();
}

/**
 * Builds the "Book this tour" hand-off for a boat pin, folding in whatever
 * trip details the guest set from the Boats filter's picker — or none, if
 * they skipped it — plus the tenant's campaign params, if any.
 */
export function buildBoatBookingHandoff(
  input: BuildBoatBookingHandoffInput,
): BoatBookingHandoff {
  const clickId = input.clickId ?? createClickId();
  const { date, guests } = input.selection;
  const rawUrl = buildBookingUrl({
    bookingUrl: input.bookingUrl,
    clickId,
    date: date ? formatBookingDate(date) : undefined,
    guests: guests > 0 ? guests : undefined,
    companySlug: input.companySlug,
    guideSlug: input.guideSlug,
  });
  const url = mergeCampaignParams(rawUrl, input.campaignParams);
  return { url, clickId };
}
