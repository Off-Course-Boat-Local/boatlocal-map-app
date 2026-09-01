"use client";

// In-app turn-by-turn walking directions — replaces the old hand-off to an
// external Google/Apple Maps app for the guest map's "Walking directions"
// button (2026-09-01 founder request: "asking for directions still leads to
// an external google maps link, i want to build something internal").
//
// Full-screen takeover, same `position: fixed inset: 0` pattern
// GuestPlaceDetail.tsx already established for the guest app's other
// full-screen overlay. Fetches its OWN route (with turn-by-turn steps) via
// /api/guest/walking-route?steps=1 rather than sharing DirectionLine's — the
// map's own line only ever needs distance/duration, this needs the full
// step list, and the two are independent user actions (selecting a pin vs.
// actually starting to walk) that don't reliably happen in the same order.
//
// PROGRESS TRACKING IS DELIBERATELY SIMPLE, NOT A REROUTING ENGINE: the
// current step advances once the guest's live position comes within
// STEP_ADVANCE_METERS of that step's endpoint. If a guest goes off the
// plotted route, the step list just stops advancing accurately rather than
// silently recalculating a new one — recalculating live would mean a fresh
// billed Routes API call on every drift, which is a real, unbounded cost
// this app does not take on lightly (see walkingRoute.ts's own cost note).
// The "Open in Google Maps instead" link at the bottom is the escape hatch
// for exactly that case — nobody is ever trapped in a stale route.
//
// DISTANCES SHOWN HERE ARE LIVE, AND RAW. Two deliberate differences from
// the rest of the guest app:
//
//  * The distance to the next turn (and the remaining total) is recomputed
//    from the guest's CURRENT position on every fix, never read straight
//    off the step's static `distanceMeters`. A number that says "160 m" for
//    the whole 160 m is worse than no number — it reads as broken.
//  * Proximity tests use raw `haversineMeters`, NOT distance.ts's padded
//    `walkingDistanceMeters`. That padding exists to keep a *quoted walking
//    estimate* honest about canal detours; applied to "am I standing at the
//    door yet" it just moves the geofence 40% closer and makes arrival
//    harder to trigger than the metres suggest.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CircleCheck,
  Compass,
  Crosshair,
  ExternalLink,
  Flag,
  MapPin as MapPinIcon,
  Maximize2,
  Navigation as NavigationArrow,
  RotateCcw,
  Signpost,
} from "lucide-react";

import BaseMap, { useMapInstance } from "@/components/map/BaseMap";
import GuestDot from "@/components/map/GuestDot";
import { createDomOverlay } from "@/components/map/DomOverlay";
import { useGuestLocation, guestPoint } from "@/hooks/useGuestLocation";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import { useWakeLock } from "@/hooks/useWakeLock";
import { bearingDegrees, haversineMeters } from "@/lib/distance";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { guestQueryString, withGuestQuery } from "@/lib/guestLinks";
import { recordGuestEvent } from "@/lib/guestEvents";
import { detectInstallPlatform, installPlatformToEventPlatform } from "@/lib/installPlatform";
import { hasShownArrivalPrompt, markArrivalPromptShown } from "@/lib/reviewPrompt";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { DIRECTIONS_LINK_PROPS, googleMapsWalkingUrl } from "@/lib/mapsHandoff";
import { BORDER, INK, MUTED, SHADOW_FLOAT, SURFACE } from "@/lib/guestTheme";

/** How close (metres, raw) to a step's endpoint counts as "reached it" — advances to the next instruction. */
const STEP_ADVANCE_METERS = 25;

/** How close (metres, raw) to the destination itself counts as arrived. Looser than a step advance: this ends navigation and asks for a review, so it has to fire reliably through normal urban GPS scatter rather than leave a guest standing at the door being told to keep walking. */
const ARRIVAL_METERS = 40;

/** Zoom used while the camera follows the walking guest. */
const FOLLOW_ZOOM = 17;

/** Where the camera is looking, and who put it there. "free" means the guest panned the map themselves — the camera then stays put until they ask for it back, because yanking a map away from someone reading it is worse than a stale camera. */
type CameraMode = "follow" | "overview" | "free";

/**
 * Formats a REAL routed distance for the turn-by-turn panel — deliberately
 * separate from distance.ts's formatWalk family, which rounds to the
 * nearest 50m specifically because IT is presenting a padded straight-line
 * guess ("don't imply false precision"). A step distance here comes
 * straight from Google's own route, so a tighter 10m rounding reads as
 * accurate rather than as invented precision.
 */
function formatStepMeters(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function remainingMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

interface RouteStep {
  instruction: string;
  maneuver: string;
  distanceMeters: number;
  durationSeconds: number;
  startLocation: { lng: number; lat: number };
  endLocation: { lng: number; lat: number };
}

interface Route {
  distanceMeters: number;
  durationSeconds: number;
  path: Array<{ lng: number; lat: number }>;
  steps: RouteStep[];
}

export interface GuestNavigationScreenProps {
  /** `id` is the recommendation's id — it keys the arrival event and the once-per-place prompt latch this screen shares with GuestMapScreen's own arrival banner. */
  destination: { id: string; lng: number; lat: number; name: string };
  /** Both optional on exactly the same terms as GuestMapScreen's own props — a tenant preview can render the guest app without either, and an arrival event with no company is simply not worth recording. */
  companyId?: string | null;
  guideId?: string | null;
  /** Who the arrival prompt asks the guest to rate — the guide whose recommendation sent them here, never the venue they walked to. */
  companyName: string;
  onClose: () => void;
}

/** Google's maneuver enum → a lucide icon. Unlisted values (roundabouts, ferries, merges — rare on foot) fall back to a plain forward arrow rather than guessing. */
function ManeuverIcon({ maneuver, className }: { maneuver: string; className?: string }) {
  switch (maneuver) {
    case "DEPART":
      return <Signpost className={className} aria-hidden />;
    case "ARRIVE":
      return <Flag className={className} aria-hidden />;
    case "TURN_LEFT":
    case "TURN_SHARP_LEFT":
      return <ArrowUpLeft className={className} aria-hidden />;
    case "TURN_SLIGHT_LEFT":
      return <ArrowUpLeft className={className} style={{ transform: "rotate(20deg)" }} aria-hidden />;
    case "TURN_RIGHT":
    case "TURN_SHARP_RIGHT":
      return <ArrowUpRight className={className} aria-hidden />;
    case "TURN_SLIGHT_RIGHT":
      return <ArrowUpRight className={className} style={{ transform: "rotate(-20deg)" }} aria-hidden />;
    case "UTURN_LEFT":
    case "UTURN_RIGHT":
      return <RotateCcw className={className} aria-hidden />;
    default:
      return <ArrowUp className={className} aria-hidden />;
  }
}

/** Draws the fetched route as a solid Polyline — same visual language as DirectionLine.tsx's real-route case, unrelated component (see this file's header for why they don't share a fetch). */
function RoutePolyline({ path, color }: { path: Array<{ lng: number; lat: number }>; color: string }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map || path.length === 0) return;
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 5,
      clickable: false,
    });
    polyline.setMap(map);
    return () => polyline.setMap(null);
  }, [map, path, color]);
  return null;
}

/** Simple destination marker — not the full <Pin>, which is built for the filterable category pins on the main map, not a one-off route endpoint. Same portal-into-an-overlay pattern MapPins/GuestDot use. */
function DestinationMarker({ position, color }: { position: { lng: number; lat: number }; color: string }) {
  const map = useMapInstance();
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!map) return;
    const overlay = createDomOverlay(map, position, "bottom");
    setEl(overlay.element);
    return () => overlay.remove();
  }, [map, position.lng, position.lat]);
  if (!el) return null;
  return createPortal(
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: "50% 50% 50% 0",
        transform: "rotate(-45deg)",
        background: color,
        border: "3px solid #FFFFFF",
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }}
    />,
    el,
  );
}

export default function GuestNavigationScreen({
  destination,
  companyId,
  guideId,
  companyName,
  onClose,
}: GuestNavigationScreenProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { location } = useGuestLocation();
  const rawGuest = guestPoint(location);

  // Pinned to primitives: guestPoint() builds a fresh object every render,
  // and this position is a dependency of the camera-follow effect — an
  // identity change on every render there would re-pan the map constantly.
  const guestLng = rawGuest?.lng ?? null;
  const guestLat = rawGuest?.lat ?? null;
  const guest = useMemo(
    () => (guestLng !== null && guestLat !== null ? { lng: guestLng, lat: guestLat } : null),
    [guestLng, guestLat],
  );

  const [route, setRoute] = useState<Route | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");

  // A guest reading a route mid-walk should not have to fight their own
  // screen timeout. Released automatically when this screen unmounts.
  useWakeLock(!arrived);

  // Fetched once, the moment a first guest fix is available — not
  // refetched on subsequent GPS ticks (see this file's header comment).
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!guest || fetchedRef.current) return;
    fetchedRef.current = true;
    const params = new URLSearchParams({
      originLng: String(guest.lng),
      originLat: String(guest.lat),
      destLng: String(destination.lng),
      destLat: String(destination.lat),
      steps: "1",
    });
    void fetch(`/api/guest/walking-route?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { route?: Route } | null) => {
        if (body?.route && body.route.steps.length > 0) {
          setRoute(body.route);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => setLoadError(true));
  }, [guest, destination.lng, destination.lat]);

  // Advance the current step once the guest passes its endpoint.
  useEffect(() => {
    if (!route || !guest || arrived) return;
    const step = route.steps[stepIndex];
    if (!step) return;
    if (haversineMeters(guest, step.endLocation) > STEP_ADVANCE_METERS) return;
    if (stepIndex < route.steps.length - 1) setStepIndex((i) => i + 1);
  }, [route, guest, stepIndex, arrived]);

  // Arrival is checked against the DESTINATION, independently of step
  // progress. A guest who cuts a corner can easily never come within
  // STEP_ADVANCE_METERS of some intermediate step's endpoint, and "you're
  // standing at the door" must not depend on having ticked off every
  // instruction on the way there.
  const destLng = destination.lng;
  const destLat = destination.lat;
  useEffect(() => {
    if (!guest || arrived) return;
    if (haversineMeters(guest, { lng: destLng, lat: destLat }) <= ARRIVAL_METERS) {
      setArrived(true);
    }
  }, [guest, arrived, destLng, destLat]);

  // The "a guest actually got there" signal behind Admin's Platform
  // analytics and Studio's Report page. Latched through the same
  // sessionStorage key GuestMapScreen's arrival banner uses, so a guest who
  // navigates here and then returns to the map is counted once, not twice.
  const destinationId = destination.id;
  useEffect(() => {
    if (!arrived || hasShownArrivalPrompt(destinationId)) return;
    markArrivalPromptShown(destinationId);
    recordGuestEvent({
      eventType: "directions_arrived",
      companyId,
      guideId,
      recommendationId: destinationId,
      platform: installPlatformToEventPlatform(
        detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
      ),
    }).catch(() => {});
  }, [arrived, destinationId, companyId, guideId]);

  /* ---- Camera ---------------------------------------------------- */

  // A manual pan hands the camera to the guest until they ask for it back.
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("dragstart", () => setCameraMode("free"));
    return () => listener.remove();
  }, [map]);

  useEffect(() => {
    if (!map || cameraMode !== "follow" || !guest) return;
    map.panTo(guest);
  }, [map, cameraMode, guest]);

  useEffect(() => {
    if (!map || cameraMode !== "overview" || !route || route.path.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    route.path.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 48);
  }, [map, cameraMode, route]);

  function followGuest() {
    setCameraMode("follow");
    // Zoom is set explicitly rather than left to the follow effect: coming
    // back from "overview" the map is zoomed out to the whole route, and a
    // bare panTo would leave the guest recentred but still looking at a
    // city-scale map.
    if (map && guest) {
      map.panTo(guest);
      map.setZoom(FOLLOW_ZOOM);
    }
  }

  /* ---- Live progress --------------------------------------------- */

  const currentStep = route?.steps[stepIndex] ?? null;
  const upcomingSteps = useMemo(
    () => (route ? route.steps.slice(stepIndex + 1) : []),
    [route, stepIndex],
  );

  /** Distance to the next turn, from where the guest is standing NOW. */
  const metersToTurn = useMemo(
    () => (guest && currentStep ? haversineMeters(guest, currentStep.endLocation) : null),
    [guest, currentStep],
  );

  const remaining = useMemo(() => {
    if (!route) return null;
    const laterSteps = route.steps
      .slice(stepIndex + 1)
      .reduce((sum, step) => sum + step.distanceMeters, 0);
    const meters = (metersToTurn ?? currentStep?.distanceMeters ?? 0) + laterSteps;
    // Scale Google's own duration by how much of the route is left, rather
    // than re-deriving a time from a walking-speed constant — the reason to
    // pay for a route at all is that its timing model beats our assumption.
    const ratio = route.distanceMeters > 0 ? Math.min(1, meters / route.distanceMeters) : 0;
    return { meters, seconds: route.durationSeconds * ratio };
  }, [route, stepIndex, metersToTurn, currentStep]);

  const fallbackUrl = googleMapsWalkingUrl({ destLat: destination.lat, destLng: destination.lng });

  // Direction-to-walk arrow: which way to face right now, not just where the
  // destination is on the map. Points at the next turn (or the destination
  // itself on the final leg), rotated by the phone's own compass heading so
  // the arrow always shows the real-world direction regardless of which way
  // the guest is holding their phone.
  const { heading, permissionNeeded, requestPermission } = useCompassHeading();
  const bearingTargetLng = currentStep?.endLocation.lng ?? destination.lng;
  const bearingTargetLat = currentStep?.endLocation.lat ?? destination.lat;
  const compassAngle = useMemo(() => {
    if (heading === null || !guest) return null;
    const bearing = bearingDegrees(guest, { lng: bearingTargetLng, lat: bearingTargetLat });
    return (bearing - heading + 360) % 360;
  }, [heading, guest, bearingTargetLng, bearingTargetLat]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.navigation.title(destination.name)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        fontFamily: bodyFontFamily,
      }}
    >
      {/* Header ------------------------------------------------------ */}
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 52,
          padding: "0 8px",
          borderBottom: `1px solid ${BORDER}`,
          boxSizing: "content-box",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: 0,
            background: "transparent",
            color: INK,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <ArrowLeft size={21} strokeWidth={2} aria-hidden />
        </button>
        <p
          className="min-w-0 flex-1 truncate"
          style={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 15, color: INK }}
        >
          {t.navigation.title(destination.name)}
        </p>
      </div>

      {/* Map ----------------------------------------------------------- */}
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>
        <BaseMap
          center={guest ?? destination}
          zoom={17}
          className="absolute inset-0"
          onMapReady={setMap}
        >
          {route ? <RoutePolyline path={route.path} color="var(--brand-primary)" /> : null}
          <DestinationMarker position={destination} color="var(--brand-primary)" />
          <GuestDot position={guest} />
        </BaseMap>
        {!map || (!route && !loadError) ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.85)" }}
          >
            <p className="text-sm" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
              {t.navigation.loading}
            </p>
          </div>
        ) : null}

        {/* Camera control — one contextual button, because "recenter" and
            "show me the whole route" are never both the useful next action:
            if the camera is already following you, the thing you can't see
            is the route; if it isn't, the thing you can't see is yourself. */}
        {!arrived && route && (
          <button
            type="button"
            onClick={cameraMode === "follow" ? () => setCameraMode("overview") : followGuest}
            className="absolute inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold"
            style={{
              left: 12,
              bottom: 12,
              background: "rgba(255,255,255,0.95)",
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW_FLOAT,
              color: INK,
              fontFamily: bodyFontFamily,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            {cameraMode === "follow" ? (
              <>
                <Maximize2 size={14} aria-hidden />
                {t.navigation.overview}
              </>
            ) : (
              <>
                <Crosshair size={14} aria-hidden />
                {t.navigation.recenter}
              </>
            )}
          </button>
        )}

        {!arrived && compassAngle !== null && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW_FLOAT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <NavigationArrow
              size={26}
              color="var(--brand-primary)"
              strokeWidth={2.25}
              style={{ transform: `rotate(${compassAngle}deg)`, transition: "transform 0.15s linear" }}
            />
          </div>
        )}

        {!arrived && compassAngle === null && permissionNeeded && (
          <button
            type="button"
            onClick={requestPermission}
            className="absolute inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
            style={{
              right: 12,
              bottom: 12,
              background: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW_FLOAT,
              color: INK,
              fontFamily: bodyFontFamily,
            }}
          >
            <Compass size={14} aria-hidden />
            {t.navigation.enableCompass}
          </button>
        )}
      </div>

      {/* Turn-by-turn panel -------------------------------------------- */}
      <div
        style={{
          flex: "0 0 auto",
          borderTop: `1px solid ${BORDER}`,
          boxShadow: SHADOW_FLOAT,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {loadError && (
          <div className="p-5 text-center">
            <p className="text-sm" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
              {t.navigation.loadError}
            </p>
            <a
              href={fallbackUrl}
              {...DIRECTIONS_LINK_PROPS}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              <ExternalLink size={15} aria-hidden />
              {t.navigation.openExternally}
            </a>
          </div>
        )}

        {/* Arrival is the one moment in the whole guest app where asking for
            a review is genuinely well-timed — the guest is standing in the
            place, not being interrupted somewhere unrelated. Same copy as
            the map's own arrival banner (t.map.arrived*), and the same
            once-per-place latch, so a guest only ever meets one of them.
            Note there is no rating step here and no branch on sentiment:
            everyone who arrives sees the same ask. */}
        {arrived && (
          <div className="flex flex-col items-center gap-2 px-6 pb-6 pt-7 text-center">
            <CircleCheck size={40} strokeWidth={1.75} color="var(--brand-primary)" aria-hidden />
            <p style={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 17, color: INK }}>
              {t.navigation.arrivedTitle(destination.name)}
            </p>
            <p className="text-[13px]" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
              {t.map.arrivedBody(companyName)}
            </p>
            <div className="mt-3 flex w-full flex-col items-stretch gap-2">
              <Link
                href={withGuestQuery("/review", guestQueryString(searchParams))}
                className="rounded-full px-6 py-3 text-center text-sm font-semibold text-white"
                style={{ background: "var(--brand-primary)" }}
              >
                {t.map.arrivedCta}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-6 py-3 text-sm font-semibold"
                style={{
                  background: "transparent",
                  border: 0,
                  color: MUTED,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {t.common.close}
              </button>
            </div>
          </div>
        )}

        {!arrived && !loadError && currentStep && (
          <>
            <div className="flex items-center gap-3.5 p-4">
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{ width: 44, height: 44, background: "var(--brand-primary)" }}
              >
                <ManeuverIcon maneuver={currentStep.maneuver} className="size-6 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p style={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 16, color: INK }}>
                  {currentStep.instruction}
                </p>
                <p className="text-[13px]" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
                  {t.navigation.stepDistance(
                    formatStepMeters(metersToTurn ?? currentStep.distanceMeters),
                  )}
                </p>
              </div>
            </div>

            <div
              className="flex items-center justify-between px-4 pb-3 text-[12.5px]"
              style={{ color: MUTED, fontFamily: bodyFontFamily }}
            >
              <span>
                <MapPinIcon size={13} className="mr-1 inline" aria-hidden />
                {t.navigation.remaining(
                  remainingMinutes(remaining?.seconds ?? 0),
                  formatStepMeters(remaining?.meters ?? 0),
                )}
              </span>
              <a
                href={fallbackUrl}
                {...DIRECTIONS_LINK_PROPS}
                className="inline-flex items-center gap-1 font-semibold"
                style={{ color: "var(--brand-primary)" }}
              >
                <ExternalLink size={13} aria-hidden />
                {t.navigation.openExternally}
              </a>
            </div>

            {/* The rest of the route, vertically — a walking instruction is
                a sentence, and sentences in a horizontal carousel get read
                as "…" plus a swipe. Capped in height so the panel can never
                grow taller than the map it is explaining. */}
            {upcomingSteps.length > 0 && (
              <div
                className="overflow-y-auto px-4 pb-4"
                style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, maxHeight: 132 }}
              >
                {upcomingSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1.5">
                    <span
                      className="mt-0.5 flex shrink-0 items-center justify-center rounded-full"
                      style={{ width: 24, height: 24, background: SURFACE, color: MUTED }}
                    >
                      <ManeuverIcon maneuver={step.maneuver} className="size-3.5" />
                    </span>
                    <span
                      className="min-w-0 flex-1 text-[12.5px] leading-4"
                      style={{ color: INK, fontFamily: bodyFontFamily }}
                    >
                      {step.instruction}
                    </span>
                    <span
                      className="shrink-0 text-[11.5px] leading-4"
                      style={{ color: MUTED, fontFamily: bodyFontFamily }}
                    >
                      {formatStepMeters(step.distanceMeters)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
