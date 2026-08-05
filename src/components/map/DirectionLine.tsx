"use client";

// The dotted "it's that way" line.
//
// This renders no DOM. It imperatively owns exactly one GeoJSON source and one
// line layer on a MapLibre map, and removes both when the selection changes or
// the component unmounts. Tapping five pins in a row must leave five removed
// layers behind, not five live ones.
//
// WHY DOTTED
// ----------
// A solid line means "follow this". In Amsterdam a straight line between two
// pins will happily cross a gracht where there is no bridge, so "follow this"
// would be a lie. Dots read as a bearing and a rough distance — "that way,
// about this far" — which is exactly what we actually know. Do not make this
// solid, and do not add an arrowhead, without changing what the product
// promises. Real routing lives behind the Google Maps hand-off button.

import { useEffect } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { DEFAULT_BRAND } from "@/lib/brand";

export const DIRECTION_LINE_SOURCE_ID = "boatlocal-direction-line";
export const DIRECTION_LINE_LAYER_ID = "boatlocal-direction-line-layer";

/**
 * Dash pattern, in multiples of the line width.
 *
 * A dash of length 0 with a round cap renders as a circle, so [0, 2] gives
 * true dots with a gap of two line-widths between them — not dashes. Widen
 * the gap and it reads as sparse/unfinished; close it and it starts to read
 * as a solid route.
 */
export const DIRECTION_LINE_DASHARRAY = [0, 2];

/** Line width in px. Dot diameter equals this. */
export const DIRECTION_LINE_WIDTH = 4;

export const DIRECTION_LINE_OPACITY = 0.85;

export interface Coordinate {
  lng: number;
  lat: number;
}

export interface DirectionLineProps {
  /** The MapLibre instance. Null while the map is still initialising. */
  map: MapLibreMap | null | undefined;
  /** Guest position. Null when location is denied/unavailable — renders nothing. */
  from: Coordinate | null | undefined;
  /** Selected place. Null when nothing is selected — renders nothing. */
  to: Coordinate | null | undefined;
  /** Insert the line below this layer id (e.g. the pin layer). */
  beforeId?: string;
  /** Override the source id, if you ever need two lines at once. */
  sourceId?: string;
  /** Override the layer id. */
  layerId?: string;
  /**
   * Line colour. Defaults to reading `--brand-primary` off the map container.
   * Pass it explicitly when the brand can change while the map stays mounted
   * (a tenant switcher, a live preview in the Studio) — the CSS variable is
   * only sampled when the layer is first created, so a stale layer would keep
   * the previous brand's colour.
   */
  color?: string;
}

/**
 * Reads the live brand colour from CSS custom properties.
 *
 * Deliberately not a hard-coded hex: the app is white-label and the brand is
 * set by `brandCssVars()` at the document (or container) level. We read from
 * the map container first so a brand scoped to a subtree still wins.
 */
export function readBrandPrimary(el?: HTMLElement | null): string {
  if (typeof window === "undefined") return DEFAULT_BRAND.primary;
  const target = el ?? document.documentElement;
  const value = getComputedStyle(target)
    .getPropertyValue("--brand-primary")
    .trim();
  return value || DEFAULT_BRAND.primary;
}

function lineFeature(
  from: Coordinate,
  to: Coordinate,
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    },
  };
}

export function DirectionLine({
  map,
  from,
  to,
  beforeId,
  color,
  sourceId = DIRECTION_LINE_SOURCE_ID,
  layerId = DIRECTION_LINE_LAYER_ID,
}: DirectionLineProps) {
  // Primitive deps only. `from`/`to` are usually fresh object literals, and
  // depending on their identity would re-add the layer on every render.
  const fromLng = from?.lng ?? null;
  const fromLat = from?.lat ?? null;
  const toLng = to?.lng ?? null;
  const toLat = to?.lat ?? null;

  useEffect(() => {
    // NOTE: `color` is in this effect's dependency array on purpose. Sampling
    // the CSS variable once when the layer is created is not enough — the
    // layer already exists by the time a tenant's brand changes, so the line
    // would keep the previous company's colour while everything else re-skins.
    if (!map) return;
    if (fromLng === null || fromLat === null) return; // no permission → no line
    if (toLng === null || toLat === null) return; // nothing selected

    const data = lineFeature(
      { lng: fromLng, lat: fromLat },
      { lng: toLng, lat: toLat },
    );

    let disposed = false;

    const paintLine = () => {
      if (disposed) return;
      try {
        const paintColor = color ?? readBrandPrimary(map.getContainer());

        const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
        if (existing) {
          existing.setData(data);
        } else {
          map.addSource(sourceId, { type: "geojson", data });
        }

        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", paintColor);
        } else {
          map.addLayer(
            {
              id: layerId,
              type: "line",
              source: sourceId,
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": paintColor,
                "line-width": DIRECTION_LINE_WIDTH,
                "line-opacity": DIRECTION_LINE_OPACITY,
                "line-dasharray": DIRECTION_LINE_DASHARRAY,
              },
            },
            // Only pass beforeId if that layer actually exists; MapLibre
            // throws otherwise, and layer order is owned by another module.
            beforeId && map.getLayer(beforeId) ? beforeId : undefined,
          );
        }
      } catch {
        // The map can be torn down mid-flight (route change, fast unmount).
        // A missing style is not an error worth crashing a card over.
      }
    };

    // setStyle() wipes user layers. Re-add whenever the style settles and our
    // layer has gone missing.
    const onStyleData = () => {
      if (disposed) return;
      try {
        if (!map.getLayer(layerId)) paintLine();
      } catch {
        /* torn down */
      }
    };

    if (map.isStyleLoaded()) {
      paintLine();
    } else {
      map.once("load", paintLine);
    }
    map.on("styledata", onStyleData);

    return () => {
      disposed = true;
      try {
        map.off("styledata", onStyleData);
        map.off("load", paintLine);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Map already destroyed — nothing left to clean up.
      }
    };
  }, [map, fromLng, fromLat, toLng, toLat, beforeId, sourceId, layerId, color]);

  return null;
}

export default DirectionLine;
