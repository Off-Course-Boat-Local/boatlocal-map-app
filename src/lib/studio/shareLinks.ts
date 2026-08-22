// Studio share-link builders — turn a company subdomain (+ guide slug, or an
// invite token) into the URL Studio actually hands out for a QR code or a
// "copy link" button.
//
// Deliberately the query-param form, not the `{subdomain}.map.boatlocal.nl`
// subdomain form the PRD describes as the eventual real routing (§13.1):
// there is no wildcard DNS/hosting for that yet, so a subdomain-shaped link
// would 404. `src/lib/guestBrand.ts`'s resolveGuestBrand() already accepts
// `?company=<subdomain>&guide=<slug>` at the plain site root as its
// documented fallback, and `src/proxy.ts` wires that up on every request —
// so the links this module builds are genuinely live *today*, including in
// this very deployment, not just illustrative placeholders.
//
// TODO: once real wildcard DNS exists, change buildGuideShareUrl/
// buildCompanyShareUrl to return `https://{subdomain}.map.boatlocal.nl[/slug]`
// instead — a one-line change here, not a rewrite of every caller (same
// "narrow the seam" shape as buildBookingUrl in src/lib/attribution.ts).

import { guestQueryString } from "../guestLinks";
import { GUEST_PREVIEW_PARAM } from "../guestHeaders";

export interface GuideShareLinkInput {
  /** Absolute origin of the current request, e.g. "https://coastal.example.com" — see requestOrigin.ts. */
  origin: string;
  subdomain: string;
  guideSlug: string;
}

/** A specific guide's own shareable link (PRD §6.2) — company + guide, both carried as query params. */
export function buildGuideShareUrl({ origin, subdomain, guideSlug }: GuideShareLinkInput): string {
  const qs = guestQueryString({ company: subdomain, guide: guideSlug });
  return `${origin}/?${qs}`;
}

export interface CompanyShareLinkInput {
  origin: string;
  subdomain: string;
}

/**
 * Company-level link/QR (PRD §7.3): the bare subdomain root, no guide path
 * or `?guide=` param — for shared/lobby placement where no single guide
 * applies. Lands on the default-guide welcome screen (see
 * src/lib/guestBrand.ts's DEFAULT_GUIDE_SLUG).
 */
export function buildCompanyShareUrl({ origin, subdomain }: CompanyShareLinkInput): string {
  const qs = guestQueryString({ company: subdomain });
  return `${origin}/?${qs}`;
}

export interface PreviewLinkInput {
  origin: string;
  subdomain: string;
  /** Omit for the company-level link (no single guide applies). */
  guideSlug?: string | null;
}

/**
 * The same guest URL as buildGuideShareUrl/buildCompanyShareUrl, plus the
 * marker that tells src/proxy.ts this is Studio's preview and none of it
 * counts as guest traffic (src/lib/guestPreview.ts).
 *
 * Built here, next to the real share links, precisely so the preview loads
 * the REAL guest app at the REAL link rather than a lookalike — the point
 * of the preview page is that clicking through it exercises what a guest
 * actually gets. The ONLY difference is this one param.
 */
export function buildGuestPreviewUrl({
  origin,
  subdomain,
  guideSlug,
}: PreviewLinkInput): string {
  const qs = guestQueryString({
    company: subdomain,
    ...(guideSlug ? { guide: guideSlug } : {}),
    [GUEST_PREVIEW_PARAM]: "1",
  });
  return `${origin}/?${qs}`;
}

export interface InviteLinkInput {
  origin: string;
  token: string;
}

/**
 * The link Studio hands a newly-invited guide (PRD §6.1/§7.3). Points at a
 * real route — src/app/join/[token]/page.tsx — that exists today and
 * renders for anyone, signed in or not (an invitee has no Studio session
 * yet, by definition). Deliberately NOT under /studio/join/...: every
 * /studio/* route is gated by src/proxy.ts's studioAuthGate, which would
 * bounce a logged-out invitee straight to /studio/login before they ever
 * saw the invite. The join page cannot yet validate the token against
 * anything, because there is no real backend to look it up in — see that
 * page's own comment.
 */
export function buildInviteUrl({ origin, token }: InviteLinkInput): string {
  return `${origin}/join/${token}`;
}
