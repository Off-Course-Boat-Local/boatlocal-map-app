// SERVER ONLY: imports `next/headers`, so this must only be called from a
// Server Component or Server Action — never from a "use client" module (see
// the same restriction documented on src/lib/studio/devAuth.ts).
//
// Best-effort absolute origin for the current request, used only to build
// shareable guest-app links (src/lib/studio/shareLinks.ts) so a QR/copy-link
// generated in Studio resolves to *this* deployment rather than a hardcoded
// hostname. Never used for anything security-sensitive — the Host header is
// client-supplied and untrustworthy for that purpose, but "which link do I
// print on a QR code" has no such requirement.

import { headers } from "next/headers";

export async function currentOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const proto =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
