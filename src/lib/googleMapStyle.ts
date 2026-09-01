// Boat Local — illustrated map style, ported to Google Maps' styling
// language (2026-09-01, alongside the MapLibre → Google Maps switch — see
// BaseMap.tsx's header comment for why).
//
// The ORIGINAL style (mapStyle.ts, kept for reference and reused for its
// MAP_COLORS palette) was a hand-written MapLibre vector-tile style with
// full control over which OpenMapTiles layers exist at all. Google's
// client-side `styles: MapTypeStyle[]` option is a different, coarser
// language — you can only show/hide/recolour Google's own predefined
// feature types (poi, road, water, …), not omit a layer from the source
// data the way mapStyle.ts could. This is a best-effort port to that
// coarser language, not a pixel-identical port: the goal it keeps from the
// original — "a curated guide cannot have competing restaurant labels
// printed on its own map" — carries over (poi/transit fully hidden below);
// exact colour-for-colour parity does not.

import { MAP_COLORS } from "./mapStyle";

export const GOOGLE_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: MAP_COLORS.land }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: MAP_COLORS.labelLand }] },
  { elementType: "labels.text.stroke", stylers: [{ color: MAP_COLORS.labelHalo }] },

  // No competing restaurant/shop pins or transit lines on a guide's own
  // curated map — the same product requirement mapStyle.ts's header
  // comment states for the original style.
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  // Road NAMES are noise at this zoom range (matches the original style
  // never referencing OpenMapTiles' road-name layer at all) — the road
  // shapes themselves stay, just unlabelled.
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },

  { featureType: "landscape", elementType: "geometry.fill", stylers: [{ color: MAP_COLORS.land }] },
  { featureType: "landscape.natural", elementType: "geometry.fill", stylers: [{ color: MAP_COLORS.park }] },
  // Re-opened after the blanket `poi: off` above — parks are the one POI
  // category worth keeping, same as the original style's dedicated park layer.
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: MAP_COLORS.park }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: MAP_COLORS.water }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: MAP_COLORS.labelWater }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: MAP_COLORS.labelHalo }] },

  // THIS IS A WALKING MAP. Founder call, 2026-09-01: "the big roads I have
  // no use for them — only add things to the map that are useful for
  // walkers." So:
  //
  //  * Motorways are removed outright. Nobody walks the A10, and at this
  //    zoom a controlled-access road is a fat band that draws the eye to
  //    the one route on the map a guest can never take.
  //  * Every remaining road is drawn in the SAME flat colour. The old
  //    style gave arterials their own darker shade to "read the grid at a
  //    glance", which is a driver's need: a driver is choosing which road
  //    to take, so hierarchy helps them. A walker takes whichever street
  //    points the right way, and that hierarchy just competes with the two
  //    things that actually orient you here — the canals and the pins.
  //
  // What's left is the walkable mesh: streets, canals, parks, buildings.
  { featureType: "road", elementType: "geometry", stylers: [{ color: MAP_COLORS.road }] },
  { featureType: "road.highway", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway.controlled_access", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: MAP_COLORS.road }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: MAP_COLORS.road }] },

  // There is no "building" feature type in Google's 2D MapTypeStyle
  // language (only in vector/WebGL 3D tiles, which this Map ID-less map
  // doesn't use — see BaseMap.tsx's header comment on why there's no Map
  // ID at all). `landscape.man_made` is Google's real feature type that
  // covers building footprints, so that's the closest honest equivalent.
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: MAP_COLORS.building }] },
];
