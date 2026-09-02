// Supabase Storage image transforms — the one place that turns a stored
// object URL into a right-sized, cacheable one.
//
// WHY THIS EXISTS: every photo in this app was being served as the original
// upload, at full resolution, into slots that are nowhere near that size —
// an 80px list thumbnail and a ~360px drawer image were both pulling the
// same ~260 KB file. Measured on production 2026-09-02: 15.69 MB of photos
// behind a single /map view, across 59 requests.
//
// Worse, Storage's `/object/public/` endpoint answers with
// `cache-control: no-cache`, so all of that refetched on EVERY visit. The
// `/render/image/public/` transform endpoint returns a real max-age AND the
// resized bytes — the same file measured at 266,807 B raw vs 66,354 B at
// width=320&quality=65.
//
// DELIBERATELY NOT next/image: that would proxy every one of these through
// Vercel's optimizer function, adding a serverless hop (and cost) in front
// of a CDN that already does exactly this job, regionally.

/** Only rewrite URLs we actually host — anything else (an absolute URL from Google Places enrichment, a data: URI predating the migrations) passes through untouched. */
const STORAGE_OBJECT_SEGMENT = "/storage/v1/object/public/";
const STORAGE_RENDER_SEGMENT = "/storage/v1/render/image/public/";

export interface PhotoUrlOptions {
  /** Rendered width in CSS pixels. Pass the size the image actually occupies, not the source size. */
  width: number;
  /** 20–100. Defaults to 65, which is visually indistinguishable at these sizes and roughly quarters the bytes. */
  quality?: number;
}

/**
 * Returns a transformed, CDN-cacheable URL for a Supabase Storage object,
 * or the input unchanged if it isn't one.
 *
 * Width is doubled for high-DPI screens — every phone this app targets is at
 * least 2x, and a 1x asset on a 3x screen is the one artefact people actually
 * notice. Doubling still lands far below the untransformed original.
 *
 * `resize=contain` IS REQUIRED — not decorative. Verified live against the
 * real Storage endpoint (2026-09-02): passing `width` alone, with the
 * transform endpoint's default resize mode ("cover", which needs BOTH
 * dimensions to define a crop box), leaves height at the SOURCE image's
 * original pixel height instead of scaling it — an 800×800 photo requested
 * at width=320 came back 320×800, and a 1497×1080 logo came back 80×1080,
 * both badly vertically stretched. `resize=contain` makes the endpoint
 * correctly derive height from the source aspect ratio when only width is
 * given. Every call site already relies on its own CSS (`object-cover` for
 * photo thumbnails, `object-contain` for the circular logo) to make the
 * final crop/fit decision, so serving an undistorted, correctly-proportioned
 * image here — rather than a pre-cropped one — is correct for all of them,
 * not just the logo.
 */
export function photoUrl(src: string | null | undefined, options: PhotoUrlOptions): string {
  if (!src) return "";
  if (!src.includes(STORAGE_OBJECT_SEGMENT)) return src;

  const quality = options.quality ?? 65;
  const width = Math.round(options.width * 2);

  const transformed = src.replace(STORAGE_OBJECT_SEGMENT, STORAGE_RENDER_SEGMENT);
  const separator = transformed.includes("?") ? "&" : "?";
  return `${transformed}${separator}width=${width}&quality=${quality}&resize=contain`;
}
