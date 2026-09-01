"use client";

// Address entry — replaces the old "type a longitude and a latitude" pair,
// shared by every portal that needs a human to place a pin (Studio's
// RecommendationForm, Admin's BoatTourForm).
//
// THE IMPORTANT PART IS THE PIN, NOT THE SEARCH. Geocoders are confidently
// wrong often enough (a chain with six branches, a canal-side entrance on
// the wrong side of the water, a POI OSM has at the building centroid) that
// silently trusting the first result would put pins in the wrong place and
// nobody would notice until a guest did. So the flow is: search → pick →
// the pin drops → **drag it to correct** → save. The stored lng/lat is
// always something a human has looked at on the map.
//
// A pasted Google Maps URL short-circuits the search step entirely (see
// parseGoogleMapsUrl in ../lib/studio/geocode.ts): if what's typed decodes
// to real coordinates, the pin drops straight there instead of being sent
// to the geocoder as a (nonsensical) search query — still draggable
// afterward, so "a human confirms the exact spot" still holds.
//
// lng/lat are still submitted, as two hidden inputs of the same names every
// call site's form already expects, so the parsers downstream of this
// (parseRecommendationForm, parseBoatTourForm) are untouched by this
// component existing.
//
// The map is a real MapLibre instance (same tiles and style as the guest
// map, so what someone positions against is what a guest will see) with a
// draggable Marker. It is lazily mounted — only once there is a coordinate
// to show — because a second WebGL context on a page that already has a
// preview map is not free.
//
// PROMOTED FROM src/components/studio/AddressField.tsx: this used to be a
// Studio-only component, styled with `--studio-*` CSS custom properties and
// Studio's own `inputClass`/`labelClass`. It moved here (see
// PortalRowMenu.tsx / PortalSelect / PortalModal / MapAppMark.tsx for the
// existing precedent — genuinely cross-portal components live directly
// under src/components/, not under admin/ or studio/) once Admin's
// BoatTourForm needed the exact same search-and-drag UX instead of raw
// lng/lat number inputs. The colours below are hardcoded hex rather than
// `var(--studio-*)`/`var(--admin-*)` because both portals' theme files
// (studio-theme.css, admin-theme.css) define these as the literal same
// values on purpose (one shared portal design, see MapAppMark.tsx's header
// comment) — if either theme file's border/surface/ink/bg tokens ever
// change, update the constants below to match.
//
// `geocodeEndpoint` defaults to Studio's own route so RecommendationForm's
// call site needed no changes for this move; Admin passes its own
// session-gated `/api/admin/geocode`.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Marker as MapLibreMarker } from "maplibre-gl";

import BaseMap, { useMapInstance } from "@/components/map/BaseMap";
import { PORTAL_ACCENT } from "@/components/MapAppMark";
import { parseGoogleMapsUrl, type GeocodeResult } from "@/lib/studio/geocode";

/** Amsterdam — the map's home city, used to bias lookups and centre an empty map. */
const DEFAULT_CENTRE = { lng: 4.8952, lat: 52.3702 };

/** Mirrors PORTAL_ACCENT (#1B5FE3) — see this file's header comment on why
 *  these are hardcoded hex rather than `var(--studio-*)`/`var(--admin-*)`. */
const BORDER_COLOR = "#ececE6";
const SURFACE_COLOR = "#ffffff";
const BG_COLOR = "#f6f6f3";
const INK_COLOR = "#1a1c22";
const INK_SOFT_COLOR = "#6b7280";

const inputClass =
  "mt-1 w-full rounded-xl border border-[#ececE6] bg-white px-3.5 py-2.5 text-sm text-[#1a1c22] outline-none transition-colors focus:border-[#1b5fe3] focus:ring-2 focus:ring-[#1b5fe3]/15";
const labelClass = "block text-sm font-medium text-[#1a1c22]";

/* ------------------------------------------------------------------ */
/*  Draggable pin                                                      */
/* ------------------------------------------------------------------ */

function DraggablePin({
  lng,
  lat,
  onMove,
}: {
  lng: number;
  lat: number;
  onMove: (next: { lng: number; lat: number }) => void;
}) {
  const map = useMapInstance();
  const markerRef = useRef<MapLibreMarker | null>(null);
  // Keeps the latest callback reachable from the marker's dragend listener
  // without re-creating the marker on every parent render. Written in its
  // own effect (not during render) — a ref is an escape hatch for event
  // handlers/effects, and mutating `.current` while rendering is exactly
  // the pattern React's own ref rules warn against, even though it's a
  // long-standing trick for this "latest callback" case.
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  });

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    (async () => {
      const { Marker } = await import("maplibre-gl");
      if (cancelled) return;

      const el = document.createElement("div");
      el.style.cssText =
        "width:22px;height:22px;border-radius:50%;cursor:grab;" +
        `background:${PORTAL_ACCENT};border:3px solid #fff;` +
        "box-shadow:0 2px 8px rgba(0,0,0,.35)";

      const marker = new Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);

      marker.on("dragstart", () => {
        el.style.cursor = "grabbing";
      });
      marker.on("dragend", () => {
        el.style.cursor = "grab";
        const { lng: nLng, lat: nLat } = marker.getLngLat();
        onMoveRef.current({ lng: nLng, lat: nLat });
      });

      markerRef.current = marker;
    })();

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
    };
    // Intentionally only on `map`: the marker is created once and then
    // repositioned by the effect below, so that dragging it doesn't tear
    // down and rebuild the marker mid-gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Keeps the pin in sync when the coordinate changes from the outside
  // (a new search result picked), without disturbing a drag in progress.
  useEffect(() => {
    markerRef.current?.setLngLat([lng, lat]);
  }, [lng, lat]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Field                                                              */
/* ------------------------------------------------------------------ */

export interface AddressFieldProps {
  initialAddress?: string;
  initialLng?: number;
  initialLat?: number;
  /** Lets the parent mirror a picked result into the Area field. */
  onAreaSuggested?: (area: string) => void;
  /** Session-gated proxy to query. Defaults to Studio's own route. */
  geocodeEndpoint?: string;
  /**
   * A pick supplied from outside the search box — e.g. Google Places
   * enrichment in AdminRecommendationForm — applied exactly like clicking a
   * Photon suggestion (pin drops, draggable, `touched` set). Bump `applyKey`
   * (e.g. a counter or Date.now()) each time a new one should be applied;
   * the same `applyPick` object with an unchanged `applyKey` is a no-op, so
   * the parent doesn't need to worry about this re-firing on unrelated
   * re-renders.
   */
  applyPick?: { address: string; area?: string; lng: number; lat: number } | null;
  applyKey?: number;
}

export default function AddressField({
  initialAddress = "",
  initialLng,
  initialLat,
  onAreaSuggested,
  geocodeEndpoint = "/api/studio/geocode",
  applyPick,
  applyKey,
}: AddressFieldProps) {
  const listId = useId();

  const [address, setAddress] = useState(initialAddress);
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(
    Number.isFinite(initialLng) && Number.isFinite(initialLat)
      ? { lng: initialLng as number, lat: initialLat as number }
      : null,
  );

  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the user picks a result, pastes a coordinate-bearing Google
  // Maps URL, or drags the pin — suppresses the "you haven't placed this
  // yet" nudge while they're still typing.
  const [touched, setTouched] = useState(false);
  // Tracks the last-applied `applyKey` so an external pick (Google Places
  // enrichment) is applied exactly once per bump, without an Effect —
  // "adjusting state when a prop changes" per React's own guidance
  // (https://react.dev/learn/you-might-not-need-an-effect), same pattern
  // AdminBoatPhotosField's `injectKey` uses.
  const [appliedApplyKey, setAppliedApplyKey] = useState(applyKey);
  // Holds an applied pick's area until the effect below can report it to the
  // parent — see that effect's own comment for why this can't happen inline
  // in the render-time block right below.
  const pendingAreaRef = useRef<string | null>(null);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced lookup. 300ms is the usual sweet spot for type-ahead: long
  // enough not to fire on every keystroke of a rate-limited free endpoint,
  // short enough to feel live. Below the 3-char threshold (or while closed)
  // this effect just declines to schedule a fetch — it does NOT clear
  // `results` itself (calling setState synchronously in an effect body
  // cascades an extra render for no benefit); `visibleResults` below hides
  // stale results for that case at render time instead.
  useEffect(() => {
    const q = address.trim();
    if (q.length < 3 || !open) {
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q });
        const bias = coords ?? DEFAULT_CENTRE;
        params.set("lat", String(bias.lat));
        params.set("lng", String(bias.lng));

        const res = await fetch(`${geocodeEndpoint}?${params}`, { signal: controller.signal });
        const body = (await res.json()) as { results?: GeocodeResult[]; error?: string };
        if (controller.signal.aborted) return;

        setResults(body.results ?? []);
        if (body.error) setError(body.error);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setError("Address lookup is unavailable — place the pin by hand.");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
    // `coords` is read only as a search bias; re-running on every pin drag
    // would refire the lookup for no benefit. `geocodeEndpoint` is a
    // caller-fixed prop, not something that changes mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, open]);

  // Close the suggestion list on an outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(r: GeocodeResult) {
    setAddress(r.address || r.label);
    setCoords({ lng: r.lng, lat: r.lat });
    setResults([]);
    setOpen(false);
    setTouched(true);
    if (r.area) onAreaSuggested?.(r.area);
  }

  // Applies an externally-supplied pick (Google Places enrichment) the same
  // way a clicked Photon suggestion would be — exactly once per `applyKey`
  // bump, during render rather than in an Effect (see appliedApplyKey's
  // comment above). This component's OWN state (address/coords/etc.) can be
  // adjusted here directly — that's React's own sanctioned "adjust state
  // when a prop changes" pattern. Calling the PARENT's `onAreaSuggested`
  // from here, though, is a second component's setState firing mid-render
  // (a real bug this app hit live: "Cannot update a component
  // (RecommendationForm) while rendering a different component
  // (AddressField)") — so that notification is only staged into a ref here
  // and actually fired from the effect below, after this render commits.
  if (
    applyKey !== appliedApplyKey &&
    applyPick &&
    Number.isFinite(applyPick.lng) &&
    Number.isFinite(applyPick.lat)
  ) {
    setAppliedApplyKey(applyKey);
    setAddress(applyPick.address);
    setCoords({ lng: applyPick.lng, lat: applyPick.lat });
    setResults([]);
    setOpen(false);
    setTouched(true);
    if (applyPick.area) pendingAreaRef.current = applyPick.area;
  }

  useEffect(() => {
    if (pendingAreaRef.current) {
      onAreaSuggested?.(pendingAreaRef.current);
      pendingAreaRef.current = null;
    }
    // Fires once per applied pick (appliedApplyKey only changes when the
    // render-time block above just staged a new area) — onAreaSuggested
    // itself is a caller-supplied callback, not meant to retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedApplyKey]);

  function handleAddressChange(value: string) {
    setAddress(value);

    // A pasted Google Maps URL already carries the exact coordinates —
    // drop the pin straight there instead of sending the URL text to the
    // geocoder as a (nonsensical) search query. The pin stays draggable
    // afterward, so "a human confirms the exact spot" still holds.
    const parsed = parseGoogleMapsUrl(value);
    if (parsed) {
      setCoords({ lng: parsed.lng, lat: parsed.lat });
      setResults([]);
      setOpen(false);
      setTouched(true);
      setError(null);
      return;
    }

    setOpen(true);
  }

  const handlePinMove = useCallback((next: { lng: number; lat: number }) => {
    setCoords(next);
    setTouched(true);
  }, []);

  const centre = coords ?? DEFAULT_CENTRE;
  // Hides stale results once the box is closed or the query drops below the
  // search threshold, without an effect having to clear `results` itself
  // (see the debounce effect's comment above for why).
  const visibleResults = open && address.trim().length >= 3 ? results : [];

  return (
    <div className="space-y-2">
      {/* The two fields the rest of the app actually consumes. Unchanged
          names, so nothing downstream knows this stopped being typed by hand. */}
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />

      <div ref={boxRef} className="relative">
        <label htmlFor={listId} className={labelClass}>
          Address
        </label>
        <input
          id={listId}
          name="address"
          required
          autoComplete="off"
          value={address}
          onChange={(e) => handleAddressChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Start typing a place or address — e.g. Bakers & Roasters"
          className={inputClass}
        />

        {open && (searching || visibleResults.length > 0) ? (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border py-1 shadow-lg"
            style={{ borderColor: BORDER_COLOR, backgroundColor: SURFACE_COLOR }}
          >
            {searching && visibleResults.length === 0 ? (
              <li className="px-3 py-2 text-sm" style={{ color: INK_SOFT_COLOR }}>
                Searching…
              </li>
            ) : null}
            {visibleResults.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => pick(r)}
                  className="block w-full px-3 py-2 text-left hover:bg-[#f6f6f3]"
                >
                  <span className="block truncate text-sm font-medium" style={{ color: INK_COLOR }}>
                    {r.label}
                  </span>
                  {r.context ? (
                    <span className="block truncate text-xs" style={{ color: INK_SOFT_COLOR }}>
                      {r.context}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="text-xs text-amber-700">{error}</p> : null}

      {coords ? (
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: BORDER_COLOR }}>
          <BaseMap center={centre} zoom={16} className="h-56 w-full" minZoom={3} maxZoom={19}>
            <DraggablePin lng={coords.lng} lat={coords.lat} onMove={handlePinMove} />
          </BaseMap>
          <div
            className="flex items-center justify-between gap-3 border-t px-3 py-2"
            style={{ borderColor: BORDER_COLOR, backgroundColor: BG_COLOR }}
          >
            <p className="text-xs" style={{ color: INK_SOFT_COLOR }}>
              Not quite right? Drag the pin — that&rsquo;s the exact spot guests get directions to.
            </p>
            <span className="shrink-0 font-mono text-[11px]" style={{ color: INK_SOFT_COLOR }}>
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs" style={{ color: INK_SOFT_COLOR }}>
          {touched
            ? "Pick a suggestion to drop the pin."
            : "Search above to drop a pin, or paste a Google Maps link — no need to know coordinates."}
        </p>
      )}
    </div>
  );
}
