"use client";

// Address entry for the Add/edit place form — replaces the old
// "type a longitude and a latitude" pair.
//
// THE IMPORTANT PART IS THE PIN, NOT THE SEARCH. Geocoders are confidently
// wrong often enough (a chain with six branches, a canal-side entrance on
// the wrong side of the water, a POI OSM has at the building centroid) that
// silently trusting the first result would put pins in the wrong place and
// nobody would notice until a guest did. So the flow is: search → pick →
// the pin drops → **drag it to correct** → save. The stored lng/lat is
// always something a human has looked at on the map.
//
// lng/lat are still submitted, as two hidden inputs of the same names the
// form always used, so parseRecommendationForm and the whole data layer
// below it are untouched by this change.
//
// The map is a real MapLibre instance (same tiles and style as the guest
// map, so what the guide positions against is what a guest will see) with
// a draggable Marker. It is lazily mounted — only once there is a
// coordinate to show — because a second WebGL context on a page that
// already has the preview map is not free.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Marker as MapLibreMarker } from "maplibre-gl";

import BaseMap, { useMapInstance } from "@/components/map/BaseMap";
import { PORTAL_ACCENT } from "@/components/MapAppMark";
import type { GeocodeResult } from "@/lib/studio/geocode";

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";
const labelClass = "block text-sm font-medium text-neutral-700";

/** Amsterdam — the map's home city, used to bias lookups and centre an empty map. */
const DEFAULT_CENTRE = { lng: 4.8952, lat: 52.3702 };

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
}

export default function AddressField({
  initialAddress = "",
  initialLng,
  initialLat,
  onAreaSuggested,
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
  // True once the user picks a result or drags the pin — suppresses the
  // "you haven't placed this yet" nudge while they're still typing.
  const [touched, setTouched] = useState(false);

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

        const res = await fetch(`/api/studio/geocode?${params}`, { signal: controller.signal });
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
    // would refire the lookup for no benefit.
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
          onChange={(e) => {
            setAddress(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Start typing a place or address — e.g. Bakers & Roasters"
          className={inputClass}
        />

        {open && (searching || visibleResults.length > 0) ? (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
          >
            {searching && visibleResults.length === 0 ? (
              <li className="px-3 py-2 text-sm text-neutral-500">Searching…</li>
            ) : null}
            {visibleResults.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => pick(r)}
                  className="block w-full px-3 py-2 text-left hover:bg-neutral-50"
                >
                  <span className="block truncate text-sm font-medium text-neutral-900">
                    {r.label}
                  </span>
                  {r.context ? (
                    <span className="block truncate text-xs text-neutral-500">{r.context}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="text-xs text-amber-700">{error}</p> : null}

      {coords ? (
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <BaseMap center={centre} zoom={16} className="h-56 w-full" minZoom={3} maxZoom={19}>
            <DraggablePin lng={coords.lng} lat={coords.lat} onMove={handlePinMove} />
          </BaseMap>
          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-600">
              Not quite right? Drag the pin — that&rsquo;s the exact spot guests get directions to.
            </p>
            <span className="shrink-0 font-mono text-[11px] text-neutral-400">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          {touched
            ? "Pick a suggestion to drop the pin."
            : "Search above to drop a pin — no need to know coordinates."}
        </p>
      )}
    </div>
  );
}
