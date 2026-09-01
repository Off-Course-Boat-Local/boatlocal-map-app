"use client";

// The integrated guest map screen — all three spike strands composed:
// the illustrated map style, the pin/filter/card UI, and the location +
// dotted-direction layer.
//
// This is the screen a guest actually opens. Everything else in /spike is a
// component harness; this is the product.

import { useMemo, useState, useSyncExternalStore } from "react";
import type { MapLibreMap } from "maplibre-gl";

import BaseMap from "@/components/map/BaseMap";
import MapPins from "@/components/map/MapPins";
import DirectionLine from "@/components/map/DirectionLine";
import FilterPills from "@/components/map/FilterPills";
import { PlaceCard } from "@/components/map/PlaceCard";
import PhoneFrame from "@/components/PhoneFrame";
import ShareQr from "@/components/ShareQr";
import GuestDot from "@/components/map/GuestDot";
import MapDiagnostics from "@/components/map/MapDiagnostics";

import { useGuestLocation, guestPoint } from "@/hooks/useGuestLocation";
import {
  LONG_WALK_METERS,
  formatWalk,
  walkCaveatFor,
  walkingDistanceMeters,
} from "@/lib/distance";
import { googleMapsWalkingUrl } from "@/lib/mapsHandoff";
import { ALL_PINS, AMSTERDAM_CENTER, GUIDE } from "@/lib/data";
import { BRANDS, brandCssVars } from "@/lib/brand";
import type { CategoryId } from "@/lib/types";

/**
 * Amsterdam's one topology trap. Everything north of the IJ is ferry-only —
 * there is no bridge. A straight dotted line to NDSM points across open
 * water, and no detour factor fixes that, so we say the true thing instead.
 */
const IJ_LATITUDE = 52.3895;

/**
 * Bump on every change that a device tester needs to actually receive.
 * Rendered server-side and visible on screen, so "am I looking at the new
 * code?" is answerable in one glance instead of by guesswork about caches.
 */
const SPIKE_BUILD = "v4";

/** The query string does not change under us; nothing to subscribe to. */
const subscribeNever = () => () => {};

export default function GuestMapSpike() {
  const [brandId, setBrandId] = useState<keyof typeof BRANDS>("coastal");
  const [filter, setFilter] = useState<CategoryId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const brand = BRANDS[brandId];

  // Real geolocation by default so a phone test exercises the actual code
  // path. `?sim=1` forces the Dam Square stand-in, for desktop work where a
  // real fix is either unavailable or wrong by a kilometre.
  //
  // Read with useSyncExternalStore rather than in an effect: the search string
  // is external, never-changing state, and setting it from an effect would
  // render one frame of the wrong mode first — which for geolocation means
  // firing a real permission prompt on a page that was asked to simulate.
  const simulate = useSyncExternalStore(
    subscribeNever,
    () => new URLSearchParams(window.location.search).get("sim") === "1",
    () => false,
  );

  const { location, reason, isSimulated, request } = useGuestLocation({
    simulate,
  });
  const guest = guestPoint(location);

  const pins = useMemo(
    () => (filter ? ALL_PINS.filter((p) => p.categories.includes(filter)) : ALL_PINS),
    [filter],
  );

  const selected = useMemo(
    () => ALL_PINS.find((p) => p.id === selectedId) ?? null,
    [selectedId],
  );

  const crossesTheIJ =
    !!selected && !!guest && selected.lat > IJ_LATITUDE && guest.lat < IJ_LATITUDE;

  const walkLine = useMemo(() => {
    if (!selected || !guest) return null;
    if (crossesTheIJ) return "Ferry from Centraal, then a short walk";
    return formatWalk(guest, selected);
  }, [selected, guest, crossesTheIJ]);

  // The caveat earns its place only when the estimate could actually mislead:
  // a long walk, or the IJ crossing. Printing "canals may add a detour" under
  // every 300 m hop is noise, and noise trains people to stop reading.
  const caveat = useMemo(() => {
    if (!selected || !guest) return null;
    if (crossesTheIJ) return "The IJ has no bridge — take the free ferry.";
    if (walkingDistanceMeters(guest, selected) >= LONG_WALK_METERS) {
      return walkCaveatFor(guest, selected);
    }
    return null;
  }, [selected, guest, crossesTheIJ]);

  return (
    <main style={brandCssVars(brand)}>
      <PhoneFrame
        aside={
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {brand.companyName}
            </p>
            <h1
              className="text-3xl leading-tight text-neutral-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {brand.appName}
            </h1>
            <p className="text-sm leading-relaxed text-neutral-600">
              {GUIDE.name}&rsquo;s picks, on a map. Scan to open it on your
              phone &mdash; that&rsquo;s where you&rsquo;ll want it.
            </p>
            <ShareQr />

            <div className="pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Skin
              </p>
              <div className="flex gap-2">
                {Object.keys(BRANDS).map((id) => (
                  <button
                    key={id}
                    onClick={() => setBrandId(id as keyof typeof BRANDS)}
                    aria-label={BRANDS[id].companyName}
                    className={`h-7 w-7 rounded-full ring-offset-2 transition ${
                      id === brandId ? "ring-2 ring-neutral-900" : ""
                    }`}
                    style={{ background: BRANDS[id].primary }}
                  />
                ))}
              </div>
            </div>
          </div>
        }
      >
        <div className="relative flex h-full w-full flex-col">
          {/* Header */}
          <header
            className="shrink-0 px-4 pb-3 pt-4 text-white"
            style={{ background: "var(--brand-primary)" }}
          >
            <h1
              className="text-2xl leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {brand.appName}
            </h1>
            <p className="mt-1 text-xs opacity-80">
              {ALL_PINS.length} recommendations from {GUIDE.name} &middot; build{" "}
              {SPIKE_BUILD}
            </p>
          </header>

          {/* Location status — visible in the spike so a device test can see
              exactly which of the four states the phone produced. This is
              debug affordance, not final UI. */}
          <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[11px] text-neutral-600">
            <span className="font-medium">location:</span> {location.status}
            {reason ? ` (${reason})` : ""}
            {isSimulated ? " · simulated" : ""}
            {location.status === "granted"
              ? ` · ±${Math.round(location.accuracy)}m`
              : null}
            {location.status === "denied" ||
            location.status === "unavailable" ? (
              <button
                type="button"
                onClick={request}
                className="ml-2 underline"
                style={{ color: "var(--brand-primary)" }}
              >
                retry
              </button>
            ) : null}
          </div>

          {/* Filters */}
          <div className="shrink-0 border-b border-neutral-200 bg-white py-2.5">
            <FilterPills value={filter} onChange={setFilter} />
          </div>

          {/* Map */}
          <div className="relative min-h-0 flex-1">
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
                onSelect={setSelectedId}
              />
              <GuestDot position={guest} />
            </BaseMap>

            <MapDiagnostics map={map} expectedPins={pins.length} />

            <DirectionLine
              map={map}
              from={guest}
              to={selected && !selected.isBoat ? selected : null}
              color={brand.primary}
            />

            {/* The distance strip and the card are one stack, so the strip
                can never end up behind a card whose height depends on how
                long the guide's note is. */}
            {selected ? (
              <div className="absolute inset-x-3 bottom-4 z-10 space-y-2">
                <div className="pointer-events-none flex justify-center">
                  <div className="rounded-full bg-white/95 px-3.5 py-1.5 shadow-sm backdrop-blur">
                    {walkLine ? (
                      <>
                        <span className="text-[13px] font-medium text-neutral-800">
                          {walkLine}
                        </span>
                        {caveat ? (
                          <span className="ml-2 text-[11px] text-neutral-500">
                            {caveat}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[13px] text-neutral-500">
                        Turn on location to see how far this is
                      </span>
                    )}
                  </div>
                </div>

                <PlaceCard
                  item={selected}
                  floating={false}
                  saved={saved.has(selected.id)}
                  onToggleSaved={(id, next) =>
                    setSaved((prev) => {
                      const s = new Set(prev);
                      if (next) s.add(id);
                      else s.delete(id);
                      return s;
                    })
                  }
                  onClose={() => setSelectedId(null)}
                  onAction={(item) => {
                    const url = item.bookingUrl
                      ? item.bookingUrl
                      : googleMapsWalkingUrl({
                          destLat: selected.lat,
                          destLng: selected.lng,
                          destName: item.name,
                        });
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </PhoneFrame>
    </main>
  );
}
