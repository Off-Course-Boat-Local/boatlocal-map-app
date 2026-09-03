// Normalizes a website value down to a bare domain — the real identity for
// a dedupe check, where `name` is too weak ("Hotel V" vs "Hotel V
// Nesplein"). Shared by outreachCsv.ts (importing) and placeCandidates.ts
// (checking a freshly-discovered place against prospects already on file)
// so the two never drift into recognizing "the same site" differently.
//
// Deliberately dumb string surgery, not the `URL` constructor: CSV/Places
// values are inconsistently bare ("360amsterdamtours.com") or full
// ("https://www.360amsterdamtours.com/tours"), and `new URL()` throws on
// the bare form without a protocol prepended first — this handles both in
// one pass without that dance.
export function normalizeWebsiteDomain(website: string | null | undefined): string | null {
  const trimmed = (website ?? "").trim();
  if (!trimmed) return null;

  const withoutProtocol = trimmed.replace(/^[a-zA-Z]+:\/\//, "");
  const withoutWww = withoutProtocol.replace(/^www\./i, "");
  const host = withoutWww.split(/[/?#]/, 1)[0].toLowerCase();

  return host || null;
}
