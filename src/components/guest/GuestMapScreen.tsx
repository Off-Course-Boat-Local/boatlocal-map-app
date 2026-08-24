"use client";

// The real guest map screen — adapted from src/app/spike/guest/page.tsx
// (kept there, unmodified, as reference material).
//
// What changed moving from the spike to here:
//   - Brand, guide name and pins arrive as props (resolved server-side by
//     src/app/(guest)/map/page.tsx via src/lib/guestServerContext.ts,
//     through the DataSource interface in src/lib/data/source.ts) instead
//     of the spike's static BRANDS/ALL_PINS/GUIDE imports and its
//     brand-switcher UI — a guest gets one tenant, not a picker.
//   - No <PhoneFrame>: the (guest) layout owns that now, once, for every
//     guest route, so a page never wraps a page.
//   - No <MapDiagnostics> or build-tag: both are explicitly commented
//     "spike-only" / "a device tester needs to see" at their definitions —
//     debug affordances that must not ship to a guest.
//   - The plain-text location debug row is replaced by nothing extra: the
//     denied/unavailable states still render (with retry), just without the
//     raw `location.status` readout.
//   - The category filter now comes from useGuestFilter()
//     (src/lib/guestFilterContext.tsx) instead of a local useState, so
//     picking "Coffee" here and switching to the List tab keeps it picked.
//   - The saved heart now comes from useSavedPlaces()
//     (src/hooks/useSavedPlaces.ts, backed by src/lib/savedPlaces.ts's
//     localStorage helpers) instead of an in-memory Set, so a save made on
//     the map shows up on the Saved screen and in the bottom nav's badge —
//     and vice versa.
//   - The action URL (book vs. walking directions) now comes from the
//     shared guestPinAction() (src/lib/guestActions.ts) so the Map, List
//     and Saved screens can't disagree about what a tap does.
//   - Picking the Boats filter now surfaces a one-off date + guest-count
//     picker (src/components/guest/BoatBookingPicker.tsx, PRD §5.5) so a
//     "Book this tour" tap can carry the guest's trip details through the
//     booking hand-off (src/lib/boatBookingHandoff.ts) — see the "Boats
//     booking details" block below.
//
// Everything else — the map, pins, filters, direction line, distance/caveat
// logic and the place card itself — is unchanged. See the header comment on
// src/components/map/DirectionLine.tsx before touching the dotted line.

import { useMemo, useState } from "react";
import type { MapLibreMap } from "maplibre-gl";

import BaseMap from "@/components/map/BaseMap";
import MapPins from "@/components/map/MapPins";
import DirectionLine from "@/components/map/DirectionLine";
import FilterPills from "@/components/map/FilterPills";
import { PlaceCard } from "@/components/map/PlaceCard";
import GuestDot from "@/components/map/GuestDot";
import BoatBookingPicker from "@/components/guest/BoatBookingPicker";
import { LanguageSwitcher } from "@/components/guest/LanguageSwitcher";

import { useGuestLocation, guestPoint } from "@/hooks/useGuestLocation";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import {
  LONG_WALK_METERS,
  walkEstimateParts,
  walkingDistanceMeters,
} from "@/lib/distance";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { guestPinAction } from "@/lib/guestActions";
import {
  DEFAULT_BOAT_BOOKING_SELECTION,
  formatBookingDateLabel,
  type BoatBookingSelection,
} from "@/lib/boatBookingHandoff";
import { recordGuestEvent } from "@/lib/guestEvents";
import { installPlatformToEventPlatform, detectInstallPlatform } from "@/lib/installPlatform";
import { useGuestFilter } from "@/lib/guestFilterContext";
import { CATEGORIES } from "@/lib/categories";
import { AMSTERDAM_CENTER } from "@/lib/data";
import type { MapPin } from "@/lib/data";
import { displayFontFamily } from "@/lib/fonts";
import type { Brand, CategoryId } from "@/lib/types";

/* Neutral chrome — never re-skins (brand colour only via --brand-primary). */
const INK = "#0B1421";
const MUTED_TEXT = "#657386";

/* Downward card shadow for the floating header/chips over the map. */
const CARD_SHADOW =
  "0 1px 2px oklch(0.19 0.03 258 / 6%), 0 12px 28px -18px oklch(0.19 0.03 258 / 22%)";

/**
 * Amsterdam's one topology trap. Everything north of the IJ is ferry-only —
 * there is no bridge. A straight dotted line to NDSM points across open
 * water, and no detour factor fixes that, so we say the true thing instead.
 */
const IJ_LATITUDE = 52.3895;

export interface GuestMapScreenProps {
  brand: Brand;
  guideName: string;
  /** Guide's URL slug (e.g. "jan") — folded into the booking hand-off's `guide` param. Null when no guide resolved for this tenant. */
  guideSlug?: string | null;
  /** Guide's real id (not the slug) — attributes "boat_book_click" to this specific guide, not just the company. Null when no guide resolved. */
  guideId?: string | null;
  /** The resolved tenant's real company id — folded into "boat_book_click" analytics. */
  companyId?: string | null;
  pins: MapPin[];
}

export default function GuestMapScreen({
  brand,
  guideName,
  guideSlug,
  guideId,
  companyId,
  pins: allPins,
}: GuestMapScreenProps) {
  const { filter, setFilter } = useGuestFilter();
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const { isSaved, toggle: toggleSaved } = useSavedPlaces();

  // Same category set, LABELS swapped for the guest's language — ids and
  // colours never change (see src/lib/categories.ts).
  const localizedCategories = useMemo(
    () => CATEGORIES.map((cat) => ({ ...cat, label: t.categories[cat.id] })),
    [t],
  );

  // Boats booking details (PRD §5.5) — a one-off date + guest-count picker
  // surfaced the first time the guest picks the Boats filter, editable again
  // from the small summary chip below the filter row. Kept here (rather than
  // in the shared filter context) because it is Map-specific trip state, not
  // a cross-screen filter choice.
  const [bookingSelection, setBookingSelection] = useState<BoatBookingSelection>(
    DEFAULT_BOAT_BOOKING_SELECTION,
  );
  const [showBookingPicker, setShowBookingPicker] = useState(false);

  function handleFilterChange(next: CategoryId | null) {
    if (next === "boats" && filter !== "boats") setShowBookingPicker(true);
    setFilter(next);
  }

  const { location, request } = useGuestLocation();
  const guest = guestPoint(location);

  const pins = useMemo(
    () => (filter ? allPins.filter((p) => p.category === filter) : allPins),
    [allPins, filter],
  );

  const selected = useMemo(
    () => allPins.find((p) => p.id === selectedId) ?? null,
    [allPins, selectedId],
  );

  const crossesTheIJ =
    !!selected && !!guest && selected.lat > IJ_LATITUDE && guest.lat < IJ_LATITUDE;

  const walkLine = useMemo(() => {
    if (!selected || !guest) return null;
    if (crossesTheIJ) return t.map.ferryLine;
    // Same banding/rounding as distance.ts's formatWalk — only the wording
    // is assembled here, per locale.
    const parts = walkEstimateParts(walkingDistanceMeters(guest, selected));
    if (parts.kind === "rightHere") {
      return parts.metersLabel
        ? `${t.map.rightHere} · ${parts.metersLabel}`
        : t.map.rightHere;
    }
    return t.map.walkLine(parts.minutes, parts.distanceLabel);
  }, [selected, guest, crossesTheIJ, t]);

  // The caveat earns its place only when the estimate could actually mislead:
  // a long walk, or the IJ crossing. Printing "canals may add a detour" under
  // every 300 m hop is noise, and noise trains people to stop reading.
  const caveat = useMemo(() => {
    if (!selected || !guest) return null;
    if (crossesTheIJ) return t.map.ferryCaveat;
    if (walkingDistanceMeters(guest, selected) >= LONG_WALK_METERS) {
      // At or past LONG_WALK_METERS this is always the long-walk caveat —
      // same rule distance.ts's walkCaveat encodes.
      return t.map.longWalkCaveat;
    }
    return null;
  }, [selected, guest, crossesTheIJ, t]);

  return (
    <div className="relative h-full w-full">
      {/* The map fills the screen edge-to-edge; the header and filters float
          over its top (the reference design's layout language) instead of
          claiming their own rows above it. */}
      {/* Phone width is ~375px, so the shared desktop zoom is far too
          close — the canal fan is the whole visual identity and it has
          to be legible in the first frame. */}
      <BaseMap
        center={AMSTERDAM_CENTER}
        zoom={12.7}
        className="absolute inset-0"
        onMapReady={setMap}
      >
        <MapPins
          pins={pins}
          selectedId={selectedId}
          onSelect={(id) => {
            // The booking picker and the PlaceCard occupy the same corner
            // of the screen — selecting a pin always wins so they can
            // never render stacked on top of each other.
            setShowBookingPicker(false);
            setSelectedId(id);
          }}
        />
        <GuestDot position={guest} />
      </BaseMap>

      <DirectionLine
        map={map}
        from={guest}
        to={selected && !selected.isBoat ? selected : null}
        color={brand.primary}
      />

      {/* Floating chrome over the map top: header pill, filter row, and the
          contextual one-liners (location retry, boats trip details). The
          wrapper is pointer-events-none so the map stays draggable around
          the floating pieces. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        // See GuestListScreen's header comment — safe-area top for
        // standalone/notched phones, env() is 0 in a browser tab.
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        {/* Header pill — with the language switcher floating top-right
            beside it (founder's annotation), in the same white/95
            backdrop-blur pill language as the header pill itself. */}
        <div className="flex items-start justify-between gap-2 px-4">
          <div
            className="pointer-events-auto rounded-full bg-white/95 px-5 py-2 backdrop-blur"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h1
              className="text-[15px] font-semibold leading-5"
              style={{ fontFamily: displayFontFamily, color: INK }}
            >
              {brand.appName}
            </h1>
            <p className="text-[11px] leading-4" style={{ color: MUTED_TEXT }}>
              {t.list.recommendationsFrom(allPins.length, guideName)}
            </p>
          </div>
          <div className="pointer-events-auto shrink-0">
            <LanguageSwitcher tone="floating" />
          </div>
        </div>

        {/* Filters */}
        <FilterPills
          className="pointer-events-auto"
          value={filter}
          onChange={handleFilterChange}
          categories={localizedCategories}
          allLabel={t.common.all}
          ariaLabel={t.list.filterAriaLabel}
          style={{ padding: "8px 16px 0" }}
        />

        {/* Location — denied/unavailable get one quiet line with a retry;
            granted and loading say nothing extra here, the distance strip on
            the card already carries that signal once a place is selected. */}
        {(location.status === "denied" || location.status === "unavailable") && (
          <div className="mt-2 flex px-4">
            <div
              className="pointer-events-auto rounded-full bg-white/95 px-3.5 py-1.5 text-[11px] backdrop-blur"
              style={{ boxShadow: CARD_SHADOW, color: MUTED_TEXT }}
            >
              {location.status === "denied"
                ? t.map.locationOff
                : t.map.locationUnavailable}
              <button
                type="button"
                onClick={request}
                className="ml-2 font-semibold underline"
                style={{ color: "var(--brand-primary)" }}
              >
                {t.map.tryAgain}
              </button>
            </div>
          </div>
        )}

        {/* Boats booking details summary — only while the Boats filter is
            active, so it never competes with the rest of the map for room. */}
        {filter === "boats" && (
          <div className="mt-2 flex px-4">
            <div
              className="pointer-events-auto flex items-center gap-3 rounded-full bg-white/95 px-3.5 py-1.5 backdrop-blur"
              style={{ boxShadow: CARD_SHADOW, fontSize: 12 }}
            >
              <span style={{ color: MUTED_TEXT }}>
                {bookingSelection.date
                  ? t.map.tripSummary(
                      formatBookingDateLabel(bookingSelection.date),
                      bookingSelection.guests,
                    )
                  : t.map.noTripDetails}
              </span>
              <button
                type="button"
                onClick={() => setShowBookingPicker(true)}
                style={{ color: "var(--brand-primary)", fontWeight: 600 }}
              >
                {bookingSelection.date ? t.map.edit : t.map.addDetails}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom stack */}
      <div className="absolute inset-x-0 bottom-0">
        {/* The distance strip and the card are one stack, so the strip
            can never end up behind a card whose height depends on how
            long the guide's note is. */}
        {selected ? (
          <div className="absolute inset-x-4 bottom-4 z-10 space-y-2">
            <div className="pointer-events-none flex justify-center">
              <div className="rounded-full bg-white/95 px-3.5 py-1.5 shadow-sm backdrop-blur">
                {walkLine ? (
                  <>
                    <span className="text-[13px] font-medium text-neutral-800">
                      {walkLine}
                    </span>
                    {caveat ? (
                      <span className="ml-2 text-[11px] text-neutral-500">{caveat}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-[13px] text-neutral-500">
                    {t.map.turnOnLocation}
                  </span>
                )}
              </div>
            </div>

            <PlaceCard
              item={selected}
              floating={false}
              saved={isSaved(selected.id)}
              onToggleSaved={(id) => toggleSaved(id)}
              onClose={() => setSelectedId(null)}
              onAction={() => {
                // PlaceCard's onAction hands back a reduced PlaceCardItem
                // (no lat/lng — see src/components/map/PlaceCard.tsx), so
                // the coordinates come from `selected`, the full MapPin
                // already in scope, exactly as before this screen used
                // guestPinAction.
                const { url, clickId } = guestPinAction(selected, {
                  selection: bookingSelection,
                  companySlug: brand.id,
                  guideSlug: guideSlug ?? undefined,
                });
                if (selected.isBoat) {
                  // Fire-and-forget: a failed analytics write must never
                  // block the guest from actually booking. See
                  // src/lib/guestEvents.ts.
                  recordGuestEvent({
                    eventType: "boat_book_click",
                    companyId,
                    guideId,
                    boatTourId: selected.id,
                    platform: installPlatformToEventPlatform(
                      detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
                    ),
                    // Same id as the booking URL's `ref` param — lets the
                    // BoatLocal conversion webhook find this exact click.
                    // See GuestPinAction's doc comment in guestActions.ts.
                    metadata: clickId ? { clickId } : undefined,
                  }).catch(() => {});
                }
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            />
          </div>
        ) : null}

        {showBookingPicker && (
          <BoatBookingPicker
            value={bookingSelection}
            onChange={setBookingSelection}
            onClose={() => setShowBookingPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
