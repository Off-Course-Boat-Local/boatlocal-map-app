// Studio share-link builders — turn a company id (+ guide slug, or an
// invite token) into the URL Studio actually hands out for a QR code or a
// "copy link" button.
//
// The query-param form is the real, permanent guest routing mechanism, not
// a stand-in for a subdomain future — companies no longer have a subdomain
// at all (see src/lib/data/types.ts's CompanyRecord and
// src/lib/guestBrand.ts's header comment for the founder's decision and the
// full reasoning). `src/lib/guestBrand.ts`'s resolveGuestBrand() accepts
// `?company=<id>&guide=<slug>` at the plain site root, and `src/proxy.ts`
// wires that up on every request — so the links this module builds are
// genuinely live *today*, including in this very deployment, not just
// illustrative placeholders.

import { guestQueryString } from "../guestLinks";
import { GUEST_PREVIEW_PARAM } from "../guestHeaders";

export interface GuideShareLinkInput {
  /** Absolute origin of the current request, e.g. "https://studio.example.com" — see requestOrigin.ts. */
  origin: string;
  companyId: string;
  guideSlug: string;
}

/** A specific guide's own shareable link (PRD §6.2) — company + guide, both carried as query params. */
export function buildGuideShareUrl({ origin, companyId, guideSlug }: GuideShareLinkInput): string {
  const qs = guestQueryString({ company: companyId, guide: guideSlug });
  return `${origin}/?${qs}`;
}

export interface CompanyShareLinkInput {
  origin: string;
  companyId: string;
}

/**
 * Company-level link/QR (PRD §7.3): just `?company=<id>`, no guide path or
 * `?guide=` param — for shared/lobby placement where no single guide
 * applies. Lands on the default-guide welcome screen (see
 * src/lib/guestBrand.ts's DEFAULT_GUIDE_SLUG).
 */
export function buildCompanyShareUrl({ origin, companyId }: CompanyShareLinkInput): string {
  const qs = guestQueryString({ company: companyId });
  return `${origin}/?${qs}`;
}

export interface PreviewLinkInput {
  origin: string;
  companyId: string;
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
  companyId,
  guideSlug,
}: PreviewLinkInput): string {
  const qs = guestQueryString({
    company: companyId,
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
