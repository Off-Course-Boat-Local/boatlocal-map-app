// Small pure helpers shared by every guest screen that has to preserve the
// `?company=`/`?guide=` query-param tenant stand-in (see src/lib/guestBrand.ts)
// across a link to another guest route.
//
// Deliberately separate from guestBrand.ts's resolution logic — that module
// turns hostname/query params INTO a tenant; this one only ever turns query
// params BACK into a string to put in an href, so a Welcome-screen "Open the
// map" button (or any other cross-tab link) never silently drops the tenant
// someone is previewing.

/** The shapes a Next.js `searchParams` prop or a real URLSearchParams can take. */
export type GuestSearchParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

/**
 * Serialises a guest `searchParams` value back into a query string, with no
 * leading "?". `undefined`/omitted input, and an input with no entries, both
 * produce "".
 */
export function guestQueryString(params?: GuestSearchParams): string {
  if (!params) return "";
  if (params instanceof URLSearchParams) return params.toString();

  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    for (const v of Array.isArray(value) ? value : [value]) out.append(key, v);
  }
  return out.toString();
}

/**
 * Appends a query string (as produced by guestQueryString, or
 * `useSearchParams().toString()`) to a path — omitting the `?` entirely
 * when there is nothing to carry, rather than leaving a trailing "?".
 */
export function withGuestQuery(pathname: string, qs: string): string {
  return qs ? `${pathname}?${qs}` : pathname;
}
