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

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import BaseMap from "@/components/map/BaseMap";
import MapPins from "@/components/map/MapPins";
import DirectionLine, { type RouteInfo } from "@/components/map/DirectionLine";
import FilterPills from "@/components/map/FilterPills";
import { PlaceCard } from "@/components/map/PlaceCard";
import GuestDot from "@/components/map/GuestDot";
import BoatBookingPicker from "@/components/guest/BoatBookingPicker";
import GuestNavigationScreen from "@/components/guest/GuestNavigationScreen";
import { LanguageSwitcher } from "@/components/guest/LanguageSwitcher";

import { useGuestLocation, guestPoint } from "@/hooks/useGuestLocation";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import {
  LONG_WALK_METERS,
  walkEstimateParts,
  walkEstimatePartsFromRoute,
  walkingDistanceMeters,
} from "@/lib/distance";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { guestPinAction } from "@/lib/guestActions";
import { guestQueryString, withGuestQuery } from "@/lib/guestLinks";
import {
  getDefaultBoatBookingSelection,
  formatBookingDateLabel,
  type BoatBookingSelection,
} from "@/lib/boatBookingHandoff";
import { recordGuestEvent } from "@/lib/guestEvents";
import { installPlatformToEventPlatform, detectInstallPlatform } from "@/lib/installPlatform";
import { hasShownArrivalPrompt, markArrivalPromptShown } from "@/lib/reviewPrompt";
import { useGuestFilter } from "@/lib/guestFilterContext";
import { CATEGORIES } from "@/lib/categories";
import { AMSTERDAM_CENTER } from "@/lib/data";
import type { MapPin } from "@/lib/data";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
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

/**
 * How close (metres) counts as "arrived" for the review-prompt banner —
 * see the arrival-detection effect below. Wide enough to absorb ordinary
 * GPS drift (typically 10-30m), tight enough that it only fires once
 * someone is actually AT the place, not just on the same block.
 */
const ARRIVAL_THRESHOLD_METERS = 60;

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
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const { isSaved, toggle: toggleSaved } = useSavedPlaces();

  // Real walking distance/duration for the currently-selected place, once
  // DirectionLine's route fetch lands — null while loading, on fetch
  // failure, or when nothing selected. See walkLine below for how this
  // supersedes the straight-line estimate once available.
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Which place the guest tapped "Walking directions" for — the signal
  // that "arrived" should actually mean something (merely tapping a pin to
  // preview it should never trigger a review ask). Cleared the moment the
  // arrival banner fires for it (a latch, not a toggle — see the effect
  // below) or when a different place is selected.
  const [directionsTappedFor, setDirectionsTappedFor] = useState<string | null>(null);
  const [arrivalPrompt, setArrivalPrompt] = useState<{ id: string; name: string } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{
    id: string;
    lng: number;
    lat: number;
    name: string;
  } | null>(null);

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
    getDefaultBoatBookingSelection,
  );
  const [showBookingPicker, setShowBookingPicker] = useState(false);

  function handleFilterChange(next: CategoryId | null) {
    if (next === "boats" && filter !== "boats") setShowBookingPicker(true);
    setFilter(next);
  }

  const { location, request } = useGuestLocation();
  const guest = guestPoint(location);
  // iOS gates deviceorientation behind an explicit per-page-load tap
  // (see useCompassHeading's own header comment) — without a button
  // somewhere on THIS screen, GuestDot's heading cone would only ever
  // start working if the guest happened to open the "Walking directions"
  // full-screen nav first and granted it there. Founder, 2026-09-02:
  // wanted the cone on the location dot itself, not tucked away in a
  // screen most selections never reach.
  const { permissionNeeded: compassPermissionNeeded, requestPermission: requestCompass } =
    useCompassHeading();

  const pins = useMemo(
    () => (filter ? allPins.filter((p) => p.categories.includes(filter)) : allPins),
    [allPins, filter],
  );

  // Boat tours synced from BoatLocal with no cruise.departure data yet sit
  // at the lat=0/lng=0 sentinel (see getMapPins in src/lib/data/source.ts —
  // that function stays deliberately unfiltered, since List needs the same
  // pins with no coordinate requirement at all). This is the one place that
  // rule actually bites: a marker on the map means a real location, so a
  // pin with no real one is dropped here, right before rendering — never
  // upstream, where it would also strip it out of the header count or
  // (were this ever reused there) any other screen. "Never geocode
  // ourselves" means this pin waits for BoatLocal, not a pin at Null Island.
  const mappablePins = useMemo(
    () => pins.filter((p) => !(p.lat === 0 && p.lng === 0)),
    [pins],
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
    // Prefer the REAL routed distance/duration (DirectionLine's Routes API
    // fetch, surfaced via onRouteInfo) once it's landed — walkEstimateParts
    // (a padded straight-line guess) is only the fallback while that's
    // still in flight or failed. Same banding/rounding either way — only
    // the wording is assembled here, per locale.
    const parts = routeInfo
      ? walkEstimatePartsFromRoute(routeInfo.distanceMeters, routeInfo.durationSeconds)
      : walkEstimateParts(walkingDistanceMeters(guest, selected));
    if (parts.kind === "rightHere") {
      return parts.metersLabel
        ? `${t.map.rightHere} · ${parts.metersLabel}`
        : t.map.rightHere;
    }
    return t.map.walkLine(parts.minutes, parts.distanceLabel);
  }, [selected, guest, crossesTheIJ, routeInfo, t]);

  // The caveat earns its place only when the estimate could actually
  // mislead: a long straight-line walk, or the IJ crossing. Printing
  // "canals may add a detour" under every 300 m hop is noise, and noise
  // trains people to stop reading — and once a REAL route has landed
  // (routeInfo), the straight-line detour caveat is no longer even true,
  // so it's suppressed entirely rather than hedging a number that isn't a
  // guess anymore. The ferry caveat is a separate, real geographic
  // constraint (no bridge, full stop) and stays regardless.
  const caveat = useMemo(() => {
    if (!selected || !guest) return null;
    if (crossesTheIJ) return t.map.ferryCaveat;
    if (routeInfo) return null;
    if (walkingDistanceMeters(guest, selected) >= LONG_WALK_METERS) {
      // At or past LONG_WALK_METERS this is always the long-walk caveat —
      // same rule distance.ts's walkCaveat encodes.
      return t.map.longWalkCaveat;
    }
    return null;
  }, [selected, guest, crossesTheIJ, routeInfo, t]);

  // Arrival detection for the review-prompt banner: once the guest has
  // tapped "Walking directions" for the currently-selected place (see
  // onAction below) AND their live position comes within
  // ARRIVAL_THRESHOLD_METERS of it, show the banner once. Prefers the same
  // real routed distance walkLine does, falling back to the straight-line
  // estimate on the same terms.
  useEffect(() => {
    if (!directionsTappedFor || !selected || selected.id !== directionsTappedFor || !guest) {
      return;
    }
    if (hasShownArrivalPrompt(selected.id)) {
      setDirectionsTappedFor(null);
      return;
    }
    const distanceMeters = routeInfo?.distanceMeters ?? walkingDistanceMeters(guest, selected);
    if (distanceMeters <= ARRIVAL_THRESHOLD_METERS) {
      setArrivalPrompt({ id: selected.id, name: selected.name });
      markArrivalPromptShown(selected.id);
      // Real "a guest actually got there" signal for Admin's Platform
      // analytics and Studio's own Report page (both already had a
      // "Directions requested" row that's shown 0 until now — see
      // src/lib/admin/analytics.ts and the Report page's METRICS list).
      // Fire-and-forget, same posture as every other guest event: a failed
      // write must never affect what the guest sees.
      recordGuestEvent({
        eventType: "directions_arrived",
        companyId,
        guideId,
        recommendationId: selected.id,
        platform: installPlatformToEventPlatform(
          detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
        ),
      }).catch(() => {});
      // Latch: stop watching once it's fired, rather than re-checking on
      // every subsequent GPS tick — one crossing event is all this needs.
      setDirectionsTappedFor(null);
    }
  }, [directionsTappedFor, selected, guest, routeInfo, companyId, guideId]);

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
          pins={mappablePins}
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
        // Only once the guest has actually pressed "Walking directions"
        // for THIS selection — not merely tapped a pin to preview it.
        // Founder report, 2026-09-02: the line (and the routed distance
        // it feeds into walkLine below) was drawing itself the instant a
        // pin was selected, before any request to go there. Reusing
        // directionsTappedFor (already the exact "did they ask for
        // directions" signal the arrival-detection effect below uses)
        // rather than adding a second flag.
        to={selected && !selected.isBoat && directionsTappedFor === selected.id ? selected : null}
        color={brand.primary}
        onRouteInfo={setRouteInfo}
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
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 px-5 py-2 backdrop-blur"
            style={{ boxShadow: CARD_SHADOW }}
          >
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt=""
                className="size-7 shrink-0 rounded-full bg-white object-contain p-0.5"
                style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }}
              />
            ) : null}
            <div className="min-w-0">
              <h1
                className="truncate text-[15px] font-semibold leading-5"
                style={{ fontFamily: displayFontFamily, color: INK }}
              >
                {brand.appName}
              </h1>
              <p className="truncate text-[11px] leading-4" style={{ color: MUTED_TEXT }}>
                {t.list.recommendationsFrom(allPins.length, guideName)}
              </p>
            </div>
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

        {/* Arrival-triggered review prompt — see ARRIVAL_THRESHOLD_METERS
            and the detection effect above. Dismissing it is permanent for
            this place this session (markArrivalPromptShown already fired
            the moment it appeared, not on dismiss) — a guest who says "not
            now" should not see it pop back up a minute later. */}
        {arrivalPrompt && (
          <div className="mt-2 flex px-4">
            <div
              className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-white/95 p-3 pl-4 backdrop-blur"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-semibold"
                  style={{ color: INK, fontFamily: displayFontFamily }}
                >
                  {t.map.arrivedTitle(arrivalPrompt.name)}
                </p>
                <p className="text-[12px]" style={{ color: MUTED_TEXT, fontFamily: bodyFontFamily }}>
                  {t.map.arrivedBody(brand.companyName)}
                </p>
              </div>
              <Link
                href={withGuestQuery("/review", guestQueryString(searchParams))}
                className="shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-white"
                style={{ background: "var(--brand-primary)", fontFamily: bodyFontFamily }}
              >
                {t.map.arrivedCta}
              </Link>
              <button
                type="button"
                onClick={() => setArrivalPrompt(null)}
                aria-label={t.map.arrivedDismiss}
                className="shrink-0 rounded-full p-1.5"
                style={{ color: MUTED_TEXT, WebkitTapHighlightColor: "transparent" }}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        )}

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

        {/* Compass permission — iOS only (see the hook above); every other
            browser fires deviceorientation with no gate at all, so
            compassPermissionNeeded just stays false there and this never
            renders. Only worth asking once location itself is on — a
            heading arrow on a dot that isn't shown yet has nothing to
            orient. */}
        {compassPermissionNeeded && location.status === "granted" && (
          <div className="mt-2 flex px-4">
            <button
              type="button"
              onClick={requestCompass}
              className="pointer-events-auto rounded-full bg-white/95 px-3.5 py-1.5 text-[11px] font-semibold backdrop-blur"
              style={{ boxShadow: CARD_SHADOW, color: "var(--brand-primary)" }}
            >
              {t.navigation.enableCompass}
            </button>
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

      {/* Bottom drawer — fixed to the actual viewport edge (not the map's
          own box, which stops short of GuestBottomNav) so a selected place
          can slide up and cover the nav bar entirely, the same way a native
          app's sheet would. See PlaceCard's `asDrawer` doc comment. */}
      {selected ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center">
          <div className="pointer-events-none mb-2 flex justify-center px-4">
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
            asDrawer
            saved={isSaved(selected.id)}
            onToggleSaved={(id) => toggleSaved(id)}
            onClose={() => setSelectedId(null)}
            className="w-full"
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
              // "Walking directions" (never "Book this tour") is the real
              // intent-to-go signal the arrival effect above watches for —
              // merely tapping a pin to preview it must never count.
              if (!selected.isBoat) {
                setDirectionsTappedFor(selected.id);
                // Real data for the "Directions requested" row Report/
                // Platform analytics have both had defined since before
                // this screen existed, with nothing ever actually firing
                // it — see directions_arrived's own comment below for the
                // matching other half of this funnel.
                recordGuestEvent({
                  eventType: "directions_requested",
                  companyId,
                  guideId,
                  recommendationId: selected.id,
                  platform: installPlatformToEventPlatform(
                    detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
                  ),
                }).catch(() => {});
              }
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
                // Booking still hands off externally — BoatLocal owns that
                // checkout flow, this app was never going to reimplement
                // it. Only "Walking directions" changes below.
                window.open(url, "_blank", "noopener,noreferrer");
                return;
              }
              // In-app turn-by-turn (GuestNavigationScreen) instead of the
              // old hand-off to an external Maps app — founder request,
              // 2026-09-01: "asking for directions still leads to an
              // external google maps link, i want to build something
              // internal". `url` (the Google Maps deep link built above)
              // isn't thrown away: GuestNavigationScreen keeps it as its
              // own "Open in Google Maps instead" escape hatch.
              setNavigationTarget({
                id: selected.id,
                lng: selected.lng,
                lat: selected.lat,
                name: selected.name,
              });
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

      {navigationTarget && (
        <GuestNavigationScreen
          destination={navigationTarget}
          companyId={companyId}
          guideId={guideId}
          companyName={brand.companyName}
          onClose={() => setNavigationTarget(null)}
        />
      )}
    </div>
  );
}
