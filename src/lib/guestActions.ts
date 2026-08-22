// The single rule for "what happens when a guest taps the primary action on
// a pin/row/card", shared by the Map, List and Saved screens so it can only
// disagree with itself if someone edits it in one place.
//
// A boat tour books; everything else hands off to Google Maps walking
// directions (see src/lib/mapsHandoff.ts for why coordinates, not the place
// name, are sent). The booking hand-off URL itself is built by
// src/lib/boatBookingHandoff.ts, which composes src/lib/attribution.ts's
// buildBookingUrl/createClickId — the one implementation of that hard rule —
// with whatever trip details (date, guest count) the guest set from the
// Boats filter's picker (src/components/guest/BoatBookingPicker.tsx). Every
// call site below gets that same click-id attribution "for free"; only the
// Map screen currently has trip details to pass in via `options`.

import {
  buildBoatBookingHandoff,
  type BoatBookingSelection,
} from "./boatBookingHandoff";
import { googleMapsWalkingUrl } from "./mapsHandoff";
import type { MapPin } from "./data";

export interface GuestPinActionOptions {
  /** Trip details from BoatBookingPicker, if the guest set any. Ignored for non-boat pins. */
  selection?: BoatBookingSelection;
  companySlug?: string;
  guideSlug?: string;
  /**
   * The tenant's campaign query-string fragment (Studio > Campaign, PRD
   * §7.6; `CompanyRecord.campaignParams`), merged onto the booking URL by
   * boatBookingHandoff.ts's mergeCampaignParams. Optional and additive.
   *
   * INTEGRATION POINT: none of the four guest screens
   * (src/components/guest/Guest{Welcome,List,Map,Saved}Screen.tsx) pass this
   * today — they only ever fetch `Brand` (src/lib/data/source.ts's
   * getCompanyBrand), not the full `CompanyRecord` that carries
   * campaignParams. Once a guest screen has that record in scope, threading
   * `companyRecord.campaignParams` in here is the entire remaining wire-up.
   */
  campaignParams?: string | null;
}

const NO_TRIP_DETAILS: BoatBookingSelection = { date: null, guests: 0 };

export interface GuestPinAction {
  url: string;
  /**
   * Set only for a boat pin — the same id that rides in the booking URL's
   * `ref` param (buildBookingUrl's clickId). The caller needs this back so
   * it can record a `boat_book_click` event carrying an identical id in its
   * metadata: that's what lets the BoatLocal conversion webhook later find
   * this exact click by matching `ref` to `metadata->>'clickId'`, rather
   * than the click and the analytics event being two disconnected records
   * that happen to have fired at the same moment.
   */
  clickId?: string;
}

/** The URL a "Book this tour" / "Walking directions" tap should open — plus
 * the click id to record alongside it, for a boat tour. */
export function guestPinAction(
  item: Pick<MapPin, "id" | "lat" | "lng" | "name" | "bookingUrl">,
  options?: GuestPinActionOptions,
): GuestPinAction {
  if (item.bookingUrl) {
    const handoff = buildBoatBookingHandoff({
      tourId: item.id,
      selection: options?.selection ?? NO_TRIP_DETAILS,
      companySlug: options?.companySlug,
      guideSlug: options?.guideSlug,
      campaignParams: options?.campaignParams,
    });
    return { url: handoff.url, clickId: handoff.clickId };
  }
  return {
    url: googleMapsWalkingUrl({ destLat: item.lat, destLng: item.lng, destName: item.name }),
  };
}

/** Label for the primary action button/row control. */
export function guestPinActionLabel(item: Pick<MapPin, "isBoat">): string {
  return item.isBoat ? "Book this tour" : "Walking directions";
}
