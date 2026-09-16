"use client";

// In-app turn-by-turn directions — replaces the old hand-off to an
// external Google/Apple Maps app for the guest map's "Walking directions"
// button (2026-09-01 founder request: "asking for directions still leads to
// an external google maps link, i want to build something internal").
//
// THREE MODES, ONE SCREEN, GOOGLE-MAPS-STYLE MODE PICKING (2026-09-15,
// extending the walk/transit split from 2026-09-04 with biking): the guest
// map's "Directions" button no longer asks which mode up front — it always
// opens this screen walking, the same way Google Maps opens on its default
// mode and lets you tap Bike/Transit afterwards. `mode` is therefore local
// STATE here, not a prop, switched by the tab row rendered below the
// header; changing it just changes the fetch key and re-runs the same
// effect. A transit itinerary comes back from the same endpoint as ONE flat
// step list spanning both travel modes — walk to the stop, ride the tram,
// walk from the stop — which is what lets everything below stay
// mode-agnostic: camera-follow, compass bearing, wake lock, GPS-proximity
// step advance and arrival detection are all pure geometry against
// `route.path`/`steps` and never ask how the guest is travelling. Only the
// STEP RENDERING branches (StepIcon + the instruction/subtext composers),
// because "Board Tram 14 toward Muiderpoortstation, get off after 4 stops"
// is a different sentence from "Turn right onto Prinsengracht", not a
// relabelled one. Biking reuses the WALK rendering branch wholesale — Google
// returns the same maneuver-based navigationInstruction shape for both.
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
  Bike,
  Bus,
  ChevronRight,
  CircleCheck,
  Compass,
  Crosshair,
  ExternalLink,
  Flag,
  Footprints,
  Loader2,
  MapPin as MapPinIcon,
  Maximize2,
  Navigation as NavigationArrow,
  RotateCcw,
  Ship,
  Signpost,
  TrainFront,
  TramFront,
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
import {
  DIRECTIONS_LINK_PROPS,
  googleMapsBikingUrl,
  googleMapsTransitUrl,
  googleMapsWalkingUrl,
} from "@/lib/mapsHandoff";
import { BRAND_GRADIENT, BORDER, INK, MUTED, SHADOW_FLOAT, SURFACE } from "@/lib/guestTheme";
import { simplifyInstruction } from "@/lib/navigationInstruction";

/** How close (metres, raw) to a WALKING step's endpoint counts as "reached it" — advances to the next instruction. */
const STEP_ADVANCE_METERS = 25;

/**
 * The same, for a TRANSIT step — deliberately far looser.
 *
 * A transit step's endpoint is Google's coordinate for the alighting stop,
 * which is a platform centroid. Nobody surfaces there: at a metro station or
 * Centraal you come up a stairwell 50-150 m away, so a 25 m window is simply
 * never entered and the step list freezes on "get off at X" while the guest
 * walks the last stretch. GPS underground makes it worse — position updates
 * stop during the ride, so the one moment inside the window may never be
 * sampled at all.
 */
const TRANSIT_STEP_ADVANCE_METERS = 150;

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

/**
 * Google's departure/arrival times are ISO 8601 in UTC; a guest wants "21:07"
 * in the clock they're reading. Returns "" for anything unparseable, which
 * the caller treats as "no departure time" rather than rendering a broken one.
 */
function formatClockTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return "";
  }
}

/**
 * Black or white, whichever is readable on `background`. Only used when
 * Google gives a line colour without its matching textColor.
 *
 * Standard sRGB relative-luminance threshold — good enough for a 24px icon
 * badge, and far better than always-white on a yellow line.
 */
function readableTextColor(background: string): string {
  const hex = background.replace("#", "");
  const full =
    hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex.slice(0, 6);
  if (full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return "#FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? INK : "#FFFFFF";
}

// Mirrored by hand from src/lib/transitRoute.ts rather than imported: that
// module carries `import "server-only"`, which would break this client
// component's build. Same reason the Route/RouteStep copies below predate
// transit. Keep the two in step when either changes.
interface TransitDetails {
  line: {
    name: string | null;
    shortName: string | null;
    color: string | null;
    textColor: string | null;
    vehicleType: string | null;
  };
  headsign: string | null;
  stopCount: number | null;
  departureStop: string | null;
  arrivalStop: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
}

interface RouteStep {
  /** Google's own turn instruction. Null on TRANSIT steps, which carry structured `transitDetails` instead — see stepInstruction() below. */
  instruction: string | null;
  maneuver: string;
  travelMode: "WALK" | "BICYCLE" | "TRANSIT";
  transitDetails?: TransitDetails | null;
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

/** Google's transit vehicle-type enum → a lucide icon. Only the types Amsterdam actually runs are mapped; everything else gets the bus, which is the honest default for "some vehicle you board". */
function VehicleIcon({ type, className }: { type: string | null; className?: string }) {
  switch (type) {
    case "TRAM":
    case "LIGHT_RAIL":
      return <TramFront className={className} aria-hidden />;
    case "SUBWAY":
    case "METRO_RAIL":
    case "MONORAIL":
    case "RAIL":
    case "HEAVY_RAIL":
    case "COMMUTER_TRAIN":
    case "HIGH_SPEED_TRAIN":
    case "LONG_DISTANCE_TRAIN":
      return <TrainFront className={className} aria-hidden />;
    case "FERRY":
      return <Ship className={className} aria-hidden />;
    default:
      return <Bus className={className} aria-hidden />;
  }
}

/** The icon for one step: a vehicle for transit legs, the maneuver arrow for walking ones. */
function StepIcon({ step, className }: { step: RouteStep; className?: string }) {
  if (step.travelMode === "TRANSIT") {
    return <VehicleIcon type={step.transitDetails?.line.vehicleType ?? null} className={className} />;
  }
  return <ManeuverIcon maneuver={step.maneuver} className={className} />;
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
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const { location, request: requestLocation } = useGuestLocation();
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
  /** A denial or hard failure, as opposed to merely still waiting on a first fix — the two need very different UI (a retry button vs. a spinner). */
  const locationBlocked = location.status === "denied" || location.status === "unavailable";

  // Always starts on foot — the Google Maps-style default — and is switched
  // by the mode tab row rendered below the header, never by a prop from the
  // caller. See this file's header comment.
  const [mode, setMode] = useState<"walk" | "bike" | "transit">("walk");
  const [route, setRoute] = useState<Route | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const [isNavigating, setIsNavigating] = useState(false);
  const [showStepsDrawer, setShowStepsDrawer] = useState(false);

  /** Tab tap handler — clears the previous mode's route/progress so nothing stale is shown while the new one loads. */
  function switchMode(next: "walk" | "bike" | "transit") {
    if (next === mode) return;
    setMode(next);
    setRoute(null);
    setLoadError(false);
    setStepIndex(0);
    setCameraMode("follow");
    setIsNavigating(false);
    setShowStepsDrawer(false);
  }

  // A guest reading a route mid-walk should not have to fight their own
  // screen timeout. Released automatically when this screen unmounts.
  useWakeLock(!arrived);

  // Fetched once per (destination, mode, language), the moment a first guest
  // fix is available — not refetched on subsequent GPS ticks (see this
  // file's header comment). Also re-runs whenever the mode tabs change
  // `mode`, since that changes the fetch key below.
  //
  // The ref holds a KEY rather than a boolean: with a plain `true` the
  // effect's own dependencies were decorative, and switching mode via the
  // tabs would have got the new mode's chrome wrapped around the previous
  // mode's route, silently.
  const fetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!guest) return;
    const fetchKey = `${mode}|${locale}|${destination.lng},${destination.lat}`;
    if (fetchedRef.current === fetchKey) return;
    fetchedRef.current = fetchKey;

    // Real data for the "Directions requested" row Report/Platform
    // analytics have both had defined since before this screen existed —
    // fired once per (mode, destination) actually fetched, which includes a
    // guest switching mode via the tabs below, not just the initial
    // "Directions" tap that opened this screen. Transit and biking bill on
    // different Routes API tiers than walking, so this is the datum that
    // later answers "is anyone using it, and is it worth what it costs?" —
    // see directions_arrived's own comment for the matching other half of
    // this funnel.
    recordGuestEvent({
      eventType: "directions_requested",
      companyId,
      guideId,
      recommendationId: destination.id,
      platform: installPlatformToEventPlatform(
        detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
      ),
      metadata: { mode },
    }).catch(() => {});

    // Closing the screen mid-flight shouldn't leave a response nobody reads
    // still downloading on a phone's mobile data — and the transit response
    // is the larger of the two. Same intent as DirectionLine's own cancel
    // flag, done with the platform's abort signal.
    const controller = new AbortController();
    const params = new URLSearchParams({
      originLng: String(guest.lng),
      originLat: String(guest.lat),
      destLng: String(destination.lng),
      destLat: String(destination.lat),
      // Only walking routes gate their step list behind this; the transit
      // endpoint always returns steps. Sent anyway so the cache key and the
      // walking path stay identical to what they were.
      steps: "1",
      mode,
      // Google localises its own instruction text when told which language
      // the guest is reading in — see walkingRoute.ts.
      lang: locale,
    });
    void fetch(`/api/guest/walking-route?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { route?: Route } | null) => {
        if (body?.route && body.route.steps.length > 0) {
          setRoute(body.route);
        } else {
          setLoadError(true);
        }
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, [guest, destination.id, destination.lng, destination.lat, mode, locale, companyId, guideId]);

  /** How close counts as "reached this step", which depends on how the guest got there. */
  function advanceThreshold(step: RouteStep): number {
    return step.travelMode === "TRANSIT" ? TRANSIT_STEP_ADVANCE_METERS : STEP_ADVANCE_METERS;
  }

  // Advance the current step once the guest passes its endpoint.
  //
  // SCANS FORWARD rather than stepping one at a time: on transit, GPS goes
  // quiet in a tunnel and comes back several steps later, and even above
  // ground a vehicle covers the 25 m window between two ~1 Hz fixes. Taking
  // the FURTHEST satisfied step means a guest who reappears past two of them
  // lands on the right instruction instead of being stuck one behind
  // forever, with no way to catch up.
  useEffect(() => {
    if (!route || !guest || arrived) return;
    let next = stepIndex;
    for (let i = stepIndex; i < route.steps.length - 1; i += 1) {
      if (haversineMeters(guest, route.steps[i].endLocation) <= advanceThreshold(route.steps[i])) {
        next = i + 1;
      }
    }
    if (next !== stepIndex) setStepIndex(next);
  }, [route, guest, stepIndex, arrived]);

  // Arrival is checked against the DESTINATION, independently of step
  // progress. A guest who cuts a corner can easily never come within
  // STEP_ADVANCE_METERS of some intermediate step's endpoint, and "you're
  // standing at the door" must not depend on having ticked off every
  // instruction on the way there.
  //
  // EXCEPT WHILE RIDING. Amsterdam's tram and bus lines run down the same
  // streets these recommendations sit on, so a vehicle passing within 40 m
  // of the venue two stops before the one the guest is meant to get off at
  // is completely ordinary — and this latch is one-way and expensive: it
  // ends navigation, releases the wake lock, swaps the turn-by-turn panel
  // for the review ask, fires `directions_arrived`, and burns the shared
  // once-per-place prompt latch so the map's own arrival banner never shows
  // either. So: not while the current step is a ride.
  const destLng = destination.lng;
  const destLat = destination.lat;
  const ridingTransit = route?.steps[stepIndex]?.travelMode === "TRANSIT";
  useEffect(() => {
    if (!guest || arrived || ridingTransit) return;
    if (haversineMeters(guest, { lng: destLng, lat: destLat }) <= ARRIVAL_METERS) {
      setArrived(true);
    }
  }, [guest, arrived, ridingTransit, destLng, destLat]);

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

  function startNavigation() {
    setIsNavigating(true);
    followGuest();
  }

  /* ---- Live progress --------------------------------------------- */

  const currentStep = route?.steps[stepIndex] ?? null;
  // Capped in COUNT as well as height: the panel only ever shows ~4 rows,
  // and walking had an implicit bound (nobody walks 20 km) that transit
  // removes — a cross-region itinerary can carry a long tail of steps that
  // would all sit in the DOM unread.
  const upcomingSteps = useMemo(
    () => (route ? route.steps.slice(stepIndex + 1, stepIndex + 13) : []),
    [route, stepIndex],
  );

  /** Distance to the next turn, from where the guest is standing NOW. */
  const metersToTurn = useMemo(
    () => (guest && currentStep ? haversineMeters(guest, currentStep.endLocation) : null),
    [guest, currentStep],
  );

  const remaining = useMemo(() => {
    if (!route) return null;
    const later = route.steps.slice(stepIndex + 1);
    const meters = (metersToTurn ?? currentStep?.distanceMeters ?? 0) + later.reduce((sum, step) => sum + step.distanceMeters, 0);

    // TIME COMES FROM THE STEPS' OWN DURATIONS, never from scaling the total
    // by distance travelled. That scaling silently assumes constant speed,
    // which is exactly what a transit itinerary isn't: after a 4.5 km metro
    // ride, a remaining 600 m walk is 11% of the distance, so a
    // distance-proportional estimate of a 25 min trip reported ~3 minutes
    // for an 8 minute walk. Always wrong in the under-reporting direction,
    // on the final leg, which is the leg people actually check. Only the
    // CURRENT step gets pro-rated, and only by how much of it is left.
    const currentFraction =
      currentStep && currentStep.distanceMeters > 0 && metersToTurn !== null
        ? Math.min(1, metersToTurn / currentStep.distanceMeters)
        : 1;
    const seconds =
      (currentStep?.durationSeconds ?? 0) * currentFraction +
      later.reduce((sum, step) => sum + step.durationSeconds, 0);

    return { meters, seconds };
  }, [route, stepIndex, metersToTurn, currentStep]);

  const fallbackUrl =
    mode === "transit"
      ? googleMapsTransitUrl({ destLat: destination.lat, destLng: destination.lng })
      : mode === "bike"
        ? googleMapsBikingUrl({ destLat: destination.lat, destLng: destination.lng })
        : googleMapsWalkingUrl({ destLat: destination.lat, destLng: destination.lng });

  /**
   * What a step actually tells the guest to do. Walking steps use Google's
   * own sentence; transit steps have none, so one is composed from the
   * structured line/headsign — falling back to whichever half exists,
   * because a tram with no headsign is still boardable and "Take 14" beats
   * an empty row.
   *
   * SHORT NAME FIRST, deliberately: it's what's actually written on the
   * front of the vehicle and on the platform sign. Verified against the
   * live API (2026-09-04) — GVB's night bus comes back as
   * nameShort "N88" vs name "Lijn 288", and an NS train as "Sprinter" vs
   * "Uitgeest <-> Rotterdam Centraal SPR4000". Preferring `name` would put
   * that second string in front of a guest looking for a train.
   */
  function stepInstruction(step: RouteStep): string {
    if (step.travelMode !== "TRANSIT") return step.instruction ?? "";
    const line = step.transitDetails?.line;
    const label = line?.shortName ?? line?.name ?? "";
    const headsign = step.transitDetails?.headsign;
    if (label && headsign) return t.navigation.board(label, headsign);
    if (label) return label;
    return step.instruction ?? "";
  }

  /** The small grey line under an instruction in the UPCOMING list: stop count on transit, distance on foot. */
  function stepSubtext(step: RouteStep): string {
    const stops = step.transitDetails?.stopCount;
    if (step.travelMode === "TRANSIT" && typeof stops === "number") {
      return t.navigation.stopsCount(stops);
    }
    return formatStepMeters(step.distanceMeters);
  }

  /**
   * The same line for the CURRENT step, which earns more detail than the
   * upcoming ones: where to get off, and — the one question a rider has that
   * a walker never does — when the thing actually leaves. On foot the
   * distance is the live one, recomputed from where the guest is standing,
   * not the step's static length.
   *
   * Falls back to `stepSubtext` when a transit step has neither a stop name
   * nor a stop count, so this can never render as a blank grey line.
   */
  function currentStepSubtext(step: RouteStep): string {
    if (step.travelMode !== "TRANSIT") {
      return t.navigation.stepDistance(formatStepMeters(metersToTurn ?? step.distanceMeters));
    }
    const parts = [
      step.transitDetails?.departureTime
        ? t.navigation.departsAt(formatClockTime(step.transitDetails.departureTime, locale))
        : null,
      step.transitDetails?.arrivalStop
        ? t.navigation.alight(step.transitDetails.arrivalStop)
        : null,
      typeof step.transitDetails?.stopCount === "number"
        ? t.navigation.stopsCount(step.transitDetails.stopCount)
        : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : stepSubtext(step);
  }

  /**
   * The badge colours for one step's icon. Transit legs wear their real line
   * colour — that's what the guest is about to look for on a vehicle and a
   * platform sign — but the foreground comes from Google's own `textColor`
   * rather than a hardcoded white, because operator colours are arbitrary
   * and plenty are light (NS yellow, #FFC917, would have made the icon
   * invisible). Falls back to a luminance test when Google omits it.
   */
  function stepBadgeColors(step: RouteStep): { background: string; color: string } {
    const line = step.travelMode === "TRANSIT" ? step.transitDetails?.line : null;
    if (!line?.color) return { background: SURFACE, color: MUTED };
    return {
      background: line.color,
      color: line.textColor ?? readableTextColor(line.color),
    };
  }

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
      {!isNavigating && (
        <>
          <div
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 52,
              padding: "0 8px",
              background: BRAND_GRADIENT,
              boxSizing: "content-box",
              paddingTop: "env(safe-area-inset-top)",
              color: "#FFFFFF",
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
                color: "#FFFFFF",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              <ArrowLeft size={21} strokeWidth={2.2} aria-hidden />
            </button>
            <p
              className="min-w-0 flex-1 truncate"
              style={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 16, color: "#FFFFFF" }}
            >
              {t.navigation.title(destination.name)}
            </p>
          </div>

          {/* Mode tabs — Google Maps-style: "Directions" always opens walking,
              and this row is where the guest actually picks biking or transit
              instead. Styled with crisp contrast over the brand color. */}
          {!arrived && (
            <div
              role="tablist"
              aria-label={t.navigation.modeSwitcherLabel}
              style={{
                flex: "0 0 auto",
                display: "flex",
                gap: 6,
                padding: "8px 10px",
                background: "var(--brand-primary)",
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {(
                [
                  { id: "walk", label: t.navigation.modeWalk, Icon: Footprints },
                  { id: "bike", label: t.navigation.modeBike, Icon: Bike },
                  { id: "transit", label: t.navigation.modeTransit, Icon: Bus },
                ] as const
              ).map((tab) => {
                const active = tab.id === mode;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={tab.label}
                    title={tab.label}
                    onClick={() => switchMode(tab.id)}
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      height: 32,
                      borderRadius: 9999,
                      border: active ? "1px solid #FFFFFF" : "1px solid rgba(255,255,255,0.22)",
                      background: active ? "#FFFFFF" : "rgba(255,255,255,0.14)",
                      color: active ? "var(--brand-primary)" : "#FFFFFF",
                      fontFamily: bodyFontFamily,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      touchAction: "manipulation",
                      boxShadow: active ? "0 2px 6px rgba(0,0,0,0.12)" : "none",
                    }}
                  >
                    <tab.Icon size={14} strokeWidth={2.2} className="shrink-0" aria-hidden />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Map ----------------------------------------------------------- */}
      <div
        style={{
          position: "relative",
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: isNavigating
              ? "perspective(800px) rotateX(42deg) scale(1.24)"
              : "none",
            transformOrigin: "50% 85%",
            transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
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
        </div>

        {/* Active Navigation: Top Instruction Card (Google Maps style) */}
        {isNavigating && !arrived && currentStep && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
          >
            <div
              className="pointer-events-auto flex w-full max-w-md items-center gap-3.5 rounded-2xl p-4 text-white shadow-xl"
              style={{
                background: "var(--brand-primary)",
              }}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <StepIcon step={currentStep} className="size-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-lg font-bold leading-snug text-white"
                  style={{ fontFamily: displayFontFamily }}
                >
                  {simplifyInstruction(stepInstruction(currentStep))}
                </p>
                <p className="text-xs font-semibold text-white/80">
                  {currentStepSubtext(currentStep)}
                </p>
              </div>
            </div>
          </div>
        )}

        {!guest && locationBlocked ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center"
            style={{ background: "rgba(255,255,255,0.85)" }}
          >
            <p className="text-sm" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
              {t.navigation.locationNeeded}
            </p>
            <button
              type="button"
              onClick={requestLocation}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: "var(--brand-primary)" }}
            >
              {t.map.tryAgain}
            </button>
          </div>
        ) : !map || (!route && !loadError) ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(255,255,255,0.85)" }}
          >
            <Loader2
              className="size-7 animate-spin"
              style={{ color: "var(--brand-primary)" }}
              strokeWidth={2.25}
              aria-hidden
            />
            <p className="text-sm" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
              {guest ? t.navigation.loading : t.navigation.locatingYou}
            </p>
          </div>
        ) : null}

        {/* Camera control */}
        {!arrived && route && (
          <button
            type="button"
            onClick={cameraMode === "follow" ? () => setCameraMode("overview") : followGuest}
            className="pointer-events-auto absolute inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold"
            style={{
              left: 12,
              bottom: isNavigating ? 98 : 12,
              background: "rgba(255,255,255,0.95)",
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW_FLOAT,
              color: INK,
              fontFamily: bodyFontFamily,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
              zIndex: 20,
              transition: "bottom 0.3s ease",
            }}
          >
            {cameraMode === "follow" ? (
              <>
                <Maximize2 size={14} aria-hidden />
                {t.navigation.overview}
              </>
            ) : (
              <>
                <NavigationArrow
                  size={13}
                  className="fill-current"
                  style={{ color: "var(--brand-primary)", transform: "rotate(45deg)" }}
                  aria-hidden
                />
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
              bottom: isNavigating ? 98 : 12,
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW_FLOAT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 20,
              transition: "bottom 0.3s ease",
            }}
          >
            <NavigationArrow
              size={24}
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
              bottom: isNavigating ? 98 : 12,
              background: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW_FLOAT,
              color: INK,
              fontFamily: bodyFontFamily,
              zIndex: 20,
              transition: "bottom 0.3s ease",
            }}
          >
            <Compass size={14} aria-hidden />
            {t.navigation.enableCompass}
          </button>
        )}
      </div>

      {/* Active Navigation: Bottom ETA Bar (Image 2 style) */}
      {isNavigating && !arrived && (
        <div
          className="relative z-30 flex-none rounded-t-3xl bg-white px-5 pt-3 shadow-2xl"
          style={{
            borderTop: `1px solid ${BORDER}`,
            paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
          }}
        >
          {/* Drag indicator */}
          <button
            type="button"
            aria-label={t.navigation.steps}
            onClick={() => setShowStepsDrawer((v) => !v)}
            className="mx-auto mb-2.5 flex h-4 w-full items-center justify-center cursor-pointer"
          >
            <span className="h-1 w-10 rounded-full bg-neutral-300" />
          </button>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-2xl font-bold tracking-tight text-neutral-900"
                  style={{ fontFamily: displayFontFamily }}
                >
                  {remainingMinutes(remaining?.seconds ?? 0)} min
                </span>
                <span className="text-neutral-500">
                  {mode === "bike" ? (
                    <Bike size={20} />
                  ) : mode === "transit" ? (
                    <Bus size={20} />
                  ) : (
                    <Footprints size={20} />
                  )}
                </span>
              </div>
              <p className="text-xs font-semibold text-neutral-500">
                {formatStepMeters(remaining?.meters ?? 0)} ·{" "}
                {formatClockTime(
                  new Date(Date.now() + (remaining?.seconds ?? 0) * 1000).toISOString(),
                  locale,
                )}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowStepsDrawer((v) => !v)}
                aria-label={t.navigation.steps}
                title={t.navigation.steps}
                className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition active:scale-95 cursor-pointer"
              >
                <Signpost size={18} />
              </button>

              <button
                type="button"
                onClick={() => setIsNavigating(false)}
                className="rounded-full bg-[#D93025] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-[#c5221f] cursor-pointer"
              >
                {t.navigation.exitNavigation}
              </button>
            </div>
          </div>

          {/* Expandable Turn-by-Turn Steps Drawer in Navigation Mode */}
          {showStepsDrawer && upcomingSteps.length > 0 && (
            <div
              className="mt-3 max-h-52 overflow-y-auto border-t pt-2"
              style={{ borderColor: BORDER }}
            >
              {upcomingSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2">
                  <span
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
                    style={stepBadgeColors(step)}
                  >
                    <StepIcon step={step} className="size-3.5" />
                  </span>
                  <span
                    className="min-w-0 flex-1 text-xs font-medium leading-4"
                    style={{ color: INK, fontFamily: bodyFontFamily }}
                  >
                    {simplifyInstruction(stepInstruction(step))}
                  </span>
                  <span
                    className="shrink-0 text-[11px] leading-4"
                    style={{ color: MUTED, fontFamily: bodyFontFamily }}
                  >
                    {stepSubtext(step)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overview Turn-by-turn panel -------------------------------------------- */}
      {!isNavigating && (
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
                  style={
                    currentStep.travelMode === "TRANSIT" && currentStep.transitDetails?.line.color
                      ? { width: 44, height: 44, ...stepBadgeColors(currentStep) }
                      : { width: 44, height: 44, background: "var(--brand-primary)", color: "#FFFFFF" }
                  }
                >
                  <StepIcon step={currentStep} className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p style={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 16, color: INK }}>
                    {simplifyInstruction(stepInstruction(currentStep))}
                  </p>
                  <p className="text-[13px]" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
                    {currentStepSubtext(currentStep)}
                  </p>
                </div>
                {stepIndex < (route?.steps.length ?? 0) - 1 && (
                  <button
                    type="button"
                    onClick={() => setStepIndex((i) => Math.min(i + 1, (route?.steps.length ?? 1) - 1))}
                    aria-label={t.navigation.nextStep}
                    className="grid size-9 shrink-0 place-items-center rounded-full"
                    style={{
                      background: SURFACE,
                      color: MUTED,
                      border: 0,
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      touchAction: "manipulation",
                    }}
                  >
                    <ChevronRight size={18} aria-hidden />
                  </button>
                )}
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
                <button
                  type="button"
                  onClick={startNavigation}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                  style={{
                    background: "var(--brand-primary)",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                >
                  <NavigationArrow
                    size={13}
                    className="fill-current"
                    style={{ transform: "rotate(45deg)" }}
                    aria-hidden
                  />
                  {t.navigation.startNavigation}
                </button>
              </div>

              {upcomingSteps.length > 0 && (
                <div
                  className="overflow-y-auto px-4 pb-4"
                  style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, maxHeight: 132 }}
                >
                  {upcomingSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-1.5">
                      <span
                        className="mt-0.5 flex shrink-0 items-center justify-center rounded-full"
                        style={{ width: 24, height: 24, ...stepBadgeColors(step) }}
                      >
                        <StepIcon step={step} className="size-3.5" />
                      </span>
                      <span
                        className="min-w-0 flex-1 text-[12.5px] leading-4"
                        style={{ color: INK, fontFamily: bodyFontFamily }}
                      >
                        {simplifyInstruction(stepInstruction(step))}
                      </span>
                      <span
                        className="shrink-0 text-[11.5px] leading-4"
                        style={{ color: MUTED, fontFamily: bodyFontFamily }}
                      >
                        {stepSubtext(step)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
