// Boat Local — illustrated map style.
//
// This is a hand-written MapLibre style, NOT a recolour of an off-the-shelf
// one. It is built from scratch against the OpenMapTiles schema so that the
// map contains ONLY the layers we want:
//
//   background → parks → water → canals → roads → buildings → geo labels
//
// Everything else in the vector tiles (POIs, shops, restaurants, house
// numbers, road names, admin boundaries, landuse hatching, transit lines)
// is simply never referenced, so it can never appear. That is a product
// requirement as much as a design one: a curated guide cannot have
// competing restaurant labels printed on its own map.
//
// Tiles: OpenFreeMap (https://openfreemap.org) — OpenMapTiles schema,
// no API key, no signup, no quota. Glyphs come from the same host.
//
// TUNING: every colour and the canal-width ramp live in the constants at
// the top of this file. Nothing below them hard-codes a colour.

import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

export const MAP_COLORS = {
  /** Warm pale sage-cream. The paper the map is printed on. */
  land: "#E4E8D6",
  /** Pale ice blue. Open water: the IJ, the Amstel, docks, lakes. */
  water: "#BCD9E8",
  /**
   * Canal strokes. Deliberately IDENTICAL to `water`: the canal lines are
   * drawn on top of the real canal polygons, and any difference at all
   * shows up as an ugly lighter core inside a darker outline once you zoom
   * past ~z15. Same colour = the stroke just fattens the polygon.
   */
  canal: "#BCD9E8",
  /** Soft sage green. Parks, no outline. */
  park: "#D2E0B9",
  /** Woodland — a shade deeper than park so the Amsterdamse Bos has weight. */
  wood: "#CCDAB2",
  /** Roads: visibly darker than the land now — founder call, 2026-09-01: "show me the roads better." */
  road: "#C9C6A9",
  /** Stronger still for the arterials, so the grid reads clearly at a glance. */
  roadMajor: "#BCB896",
  /** Soft tan for the handful of buildings we do show. */
  building: "#DDD0B6",
  /** Muted blue-grey for water names. */
  labelWater: "#7C9CAF",
  /** Muted warm grey-brown for district and landmark names. */
  labelLand: "#8C8A72",
  /** Halo = the paper colour, so labels sit *in* the paper, not on top. */
  labelHalo: "#E7EADB",
} as const;

export type MapColors = typeof MAP_COLORS;

/* ------------------------------------------------------------------ */
/*  Tiles + glyphs                                                     */
/* ------------------------------------------------------------------ */

export const TILE_SOURCE_URL = "https://tiles.openfreemap.org/planet";
export const GLYPHS_URL =
  "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/**
 * The label face.
 *
 * LIMITATION: OpenFreeMap ships exactly three fontstacks — Noto Sans
 * Regular / Italic / Bold. There is no serif in any free, no-key glyph
 * server we could find (openmaptiles' public font host, protomaps'
 * asset host and MapLibre's demo host were all checked). So the closest
 * available face is Noto Sans Italic: it gets us the *italic* half of
 * "italic serif" but not the serif half.
 *
 * To close that gap we self-host glyph PBFs generated from a real serif
 * italic — see the note in the spike report. `buildMapStyle` takes a
 * `glyphs` override precisely so that swap is a one-line change.
 */
export const LABEL_FONT = ["Noto Sans Italic"];

export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> · ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>';

/* ------------------------------------------------------------------ */
/*  Curated geography labels                                           */
/* ------------------------------------------------------------------ */

export type GeoLabelKind = "water" | "district" | "landmark";

export interface GeoLabel {
  name: string;
  lng: number;
  lat: number;
  kind: GeoLabelKind;
  /** Label appears at or above this zoom. */
  minzoom: number;
}

/**
 * The ONLY names on the map.
 *
 * Hand-placed on purpose. Pulling these out of the `place` / `water_name`
 * vector layers would work, but it hands editorial control to OSM: we'd
 * get every hamlet and drainage ditch name in the bbox, in whatever
 * language OSM happens to have. Twelve names, chosen and positioned, is
 * what an illustrated guide map actually has.
 */
export const GEO_LABELS: GeoLabel[] = [
  { name: "Het IJ", lng: 4.9165, lat: 52.3855, kind: "water", minzoom: 11 },
  { name: "Het IJ", lng: 4.8785, lat: 52.3905, kind: "water", minzoom: 12.5 },
  { name: "Amstel", lng: 4.9035, lat: 52.3555, kind: "water", minzoom: 12.5 },
  { name: "Centraal", lng: 4.9003, lat: 52.3789, kind: "landmark", minzoom: 12 },
  { name: "Dam", lng: 4.8931, lat: 52.3731, kind: "landmark", minzoom: 13 },
  { name: "Vondelpark", lng: 4.8686, lat: 52.3578, kind: "landmark", minzoom: 12.5 },
  { name: "Jordaan", lng: 4.8805, lat: 52.3762, kind: "district", minzoom: 12.5 },
  { name: "De Pijp", lng: 4.8938, lat: 52.3538, kind: "district", minzoom: 12.5 },
  { name: "Oud-West", lng: 4.8672, lat: 52.3665, kind: "district", minzoom: 13 },
  { name: "Plantage", lng: 4.9155, lat: 52.3655, kind: "district", minzoom: 13 },
  { name: "Westerpark", lng: 4.8735, lat: 52.3868, kind: "district", minzoom: 13 },
  { name: "Noord", lng: 4.9020, lat: 52.3955, kind: "district", minzoom: 12 },
];

function geoLabelFeatureCollection(labels: GeoLabel[]) {
  return {
    type: "FeatureCollection" as const,
    features: labels.map((l) => ({
      type: "Feature" as const,
      properties: { name: l.name, kind: l.kind, minzoom: l.minzoom },
      geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Shared expressions                                                 */
/* ------------------------------------------------------------------ */

type Stop = [number, number];

/** exponential interpolate on zoom */
const zoomRamp = (
  base: number,
  stops: Stop[],
): DataDrivenPropertyValueSpecification<number> =>
  [
    "interpolate",
    ["exponential", base],
    ["zoom"],
    ...stops.flat(),
  ] as unknown as DataDrivenPropertyValueSpecification<number>;

/**
 * The canal ramp. THE most important number in this file.
 *
 * True width of a main gracht is ~25 m. At z13 that is under 2 px — the
 * canal ring would be a faint scratch. These widths run roughly 2–3× true
 * scale at z12–14 and settle back toward true scale by z16, so the fan
 * pattern reads instantly when you open the map and the canals still line
 * up with the houses when you zoom into a street.
 */
const CANAL_WIDTH = zoomRamp(1.55, [
  [10, 1.2],
  [11, 3.0],
  [12, 6.4],
  [13, 11],
  [14, 16],
  [15, 20],
  [16, 24],
  [17, 28],
  [18, 32],
]);

/** Minor grachten / singels — the same idea, dialled back. */
const CANAL_WIDTH_MINOR = zoomRamp(1.55, [
  [12, 1.6],
  [13, 4.2],
  [14, 7.5],
  [15, 11],
  [16, 15],
  [17, 18],
  [18, 22],
]);

/* ------------------------------------------------------------------ */
/*  Layers                                                             */
/* ------------------------------------------------------------------ */

function baseLayers(c: MapColors): LayerSpecification[] {
  return [
    /* ---------- paper ---------- */
    {
      id: "background",
      type: "background",
      paint: { "background-color": c.land },
    },

    /* ---------- greenery -------------------------------------------
     * Two sources of green: `landcover` (wood/grass, the actual tree and
     * lawn polygons) and `park` (the named park boundaries). Drawn with
     * no outline at all — a hard edge instantly reads as "GIS", not
     * "illustration".
     * -------------------------------------------------------------- */
    {
      id: "landcover-wood",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": c.wood, "fill-antialias": true },
    },
    {
      id: "landcover-grass",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "farmland"]]],
      paint: { "fill-color": c.park },
    },
    // NOTE: the `park` layer is NOT "parks". In OpenMapTiles it is
    // protected areas — and Amsterdam's entire 17th-century canal ring is a
    // UNESCO protected_area, so drawing this layer naively paints a huge
    // green stripe over the middle of the city. Only real green protected
    // land is wanted here.
    {
      id: "park",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "park",
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["national_park", "nature_reserve"]],
      ],
      paint: { "fill-color": c.park },
    },
    // Green sports pitches / cemeteries read as park in an illustrated map.
    {
      id: "landuse-green",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["cemetery", "pitch", "stadium", "zoo"]],
      ],
      paint: { "fill-color": c.park, "fill-opacity": 0.85 },
    },

    /* ---------- roads -----------------------------------------------
     * Was "deliberately dull" (opacity ramped down hard at low zoom so
     * canals/parks did all the work) — founder call, 2026-09-01: "show me
     * the roads better." Same layer structure, stronger colour (see
     * MAP_COLORS) and opacity now ramps up earlier/higher so the street
     * grid is legible at the zoom a guest actually browses at, not just
     * once you're zoomed into a single street.
     * -------------------------------------------------------------- */
    {
      id: "road-minor",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 12,
      filter: [
        "all",
        ["!=", ["get", "brunnel"], "tunnel"],
        [
          "in",
          ["get", "class"],
          ["literal", ["minor", "service", "pedestrian", "path"]],
        ],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c.road,
        "line-width": zoomRamp(1.5, [
          [12, 0.3],
          [14, 1],
          [16, 3.4],
          [18, 10],
        ]),
        "line-opacity": zoomRamp(1, [
          [12, 0.3],
          [13.5, 0.55],
          [15, 0.75],
          [17, 0.95],
        ]),
      },
    },
    {
      id: "road-major",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 10,
      filter: [
        "all",
        ["!=", ["get", "brunnel"], "tunnel"],
        [
          "in",
          ["get", "class"],
          [
            "literal",
            ["motorway", "trunk", "primary", "secondary", "tertiary"],
          ],
        ],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c.roadMajor,
        "line-width": zoomRamp(1.5, [
          [10, 0.4],
          [12, 1],
          [14, 2.2],
          [16, 6],
          [18, 15],
        ]),
        "line-opacity": zoomRamp(1, [
          [10, 0.35],
          [12, 0.55],
          [14, 0.75],
          [17, 1],
        ]),
      },
    },

    /* ---------- water ------------------------------------------------
     * Polygons first (the IJ, the Amstel, docks, the wide bits of the
     * grachten), then the exaggerated canal strokes on top. Both use
     * the same family of blues so the join is invisible.
     * -------------------------------------------------------------- */
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      filter: ["!=", ["get", "class"], "swimming_pool"],
      paint: { "fill-color": c.water, "fill-antialias": true },
    },

    // The canal ring. Round caps + round joins are what make it look drawn.
    {
      id: "canal-minor",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      // Below this the polder ditches west and south of the city turn into
      // visual static that competes with the canal ring.
      minzoom: 12.5,
      filter: [
        "all",
        ["!=", ["get", "brunnel"], "tunnel"],
        ["in", ["get", "class"], ["literal", ["ditch", "drain", "stream"]]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c.canal,
        "line-width": CANAL_WIDTH_MINOR,
        "line-blur": 0.6,
      },
    },
    {
      id: "canal",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      minzoom: 9,
      filter: [
        "all",
        ["!=", ["get", "brunnel"], "tunnel"],
        ["in", ["get", "class"], ["literal", ["canal", "river"]]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c.canal,
        "line-width": CANAL_WIDTH,
        // A hair of blur is the difference between "vector stroke" and
        // "someone drew this with a soft brush".
        "line-blur": 0.8,
      },
    },

    /* ---------- buildings --------------------------------------------
     * Mostly not shown. The OpenMapTiles `building` layer carries no
     * name or class, so we cannot pick out Centraal Station by name —
     * see the report. Instead buildings fade in only once you are close
     * enough that empty blocks would look broken, and even then they sit
     * at low opacity as soft tan blocks.
     * -------------------------------------------------------------- */
    {
      id: "building",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 16,
      paint: {
        "fill-color": c.building,
        // Kept low: the tiles top out at z14, so at street zoom the building
        // polygons are heavily generalised and merge into block-sized blobs.
        // At full strength that reads as a stain across the page.
        "fill-opacity": zoomRamp(1, [
          [16, 0],
          [17, 0.35],
          [18.5, 0.5],
        ]),
        "fill-antialias": true,
      },
    },
  ];
}

function labelLayers(c: MapColors, fonts: string[]): LayerSpecification[] {
  const visibleAtZoom: ExpressionSpecification = [
    ">=",
    ["zoom"],
    ["get", "minzoom"],
  ];

  return [
    {
      id: "geo-label-water",
      type: "symbol",
      source: "geo-labels",
      filter: ["all", ["==", ["get", "kind"], "water"], visibleAtZoom],
      layout: {
        "text-field": ["get", "name"],
        "text-font": fonts,
        "text-size": zoomRamp(1, [
          [11, 11],
          [13, 14],
          [16, 19],
        ]),
        "text-letter-spacing": 0.12,
        "text-max-width": 8,
        "text-allow-overlap": false,
        "text-padding": 6,
      },
      paint: {
        "text-color": c.labelWater,
        "text-halo-color": MAP_COLORS.water,
        "text-halo-width": 1.1,
        "text-halo-blur": 1,
        "text-opacity": 0.95,
      },
    },
    {
      id: "geo-label-land",
      type: "symbol",
      source: "geo-labels",
      filter: ["all", ["!=", ["get", "kind"], "water"], visibleAtZoom],
      layout: {
        "text-field": ["get", "name"],
        "text-font": fonts,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          ["case", ["==", ["get", "kind"], "landmark"], 11, 10.5],
          13,
          ["case", ["==", ["get", "kind"], "landmark"], 14, 13],
          16,
          ["case", ["==", ["get", "kind"], "landmark"], 20, 18],
        ],
        "text-letter-spacing": 0.14,
        "text-max-width": 8,
        "text-allow-overlap": false,
        "text-padding": 8,
      },
      paint: {
        "text-color": c.labelLand,
        "text-halo-color": c.labelHalo,
        "text-halo-width": 1.4,
        "text-halo-blur": 1,
        "text-opacity": 0.92,
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface BuildMapStyleOptions {
  /** Override any subset of the palette. */
  colors?: Partial<MapColors>;
  /**
   * Draw the curated geography names. Turn off if you want to render
   * them yourself as DOM overlays (which is currently the only way to
   * get a true serif — see LABEL_FONT).
   */
  geoLabels?: boolean;
  /** Replace the curated label set. */
  labels?: GeoLabel[];
  /** Point at a self-hosted glyph endpoint. */
  glyphs?: string;
  /** Fontstack for labels, e.g. ["EB Garamond Italic"] if self-hosting. */
  labelFont?: string[];
}

/**
 * Build the Boat Local illustrated map style.
 *
 * Returns a plain, fully self-contained StyleSpecification — no sprite,
 * no external style JSON, nothing to fetch beyond tiles and glyphs.
 */
export function buildMapStyle(
  options: BuildMapStyleOptions = {},
): StyleSpecification {
  const c: MapColors = { ...MAP_COLORS, ...options.colors };
  const showLabels = options.geoLabels ?? true;
  const labels = options.labels ?? GEO_LABELS;
  const fonts = options.labelFont ?? LABEL_FONT;

  return {
    version: 8,
    name: "Boat Local — Illustrated Amsterdam",
    glyphs: options.glyphs ?? GLYPHS_URL,
    sources: {
      openmaptiles: {
        type: "vector",
        url: TILE_SOURCE_URL,
        attribution: ATTRIBUTION,
      },
      "geo-labels": {
        type: "geojson",
        data: geoLabelFeatureCollection(showLabels ? labels : []),
      },
    },
    layers: [...baseLayers(c), ...labelLayers(c, fonts)],
  };
}

/** Convenience: the default style with no overrides. */
export const BOAT_LOCAL_STYLE = buildMapStyle();
