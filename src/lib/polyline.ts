// Google's polyline encoding — decoder only, since this app only ever
// consumes routes Google already encoded (Routes API), never encodes its
// own. Pure/no "server-only" import on purpose (unlike walkingRoute.ts,
// which does need that guard) so this stays testable from a plain vitest
// run and importable from a client component (DirectionLine.tsx never
// calls it directly today, but the algorithm belongs here regardless of
// which side ends up using it).

/**
 * Decodes Google's polyline encoding — the same algorithm the Routes,
 * Directions and legacy Maps APIs all share — into [lng, lat] pairs (as
 * `{ lng, lat }` objects, matching this app's own Coordinate shape rather
 * than Google's array-of-arrays convention).
 */
export function decodePolyline(encoded: string): Array<{ lng: number; lat: number }> {
  const points: Array<{ lng: number; lat: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lng: lng / 1e5, lat: lat / 1e5 });
  }

  return points;
}
