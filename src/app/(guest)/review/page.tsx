// The guest Review screen (PRD §5.6) — the COMPANY review ask only.
//
// HARD RULE: reviews are two SEPARATE flows.
//   (a) THIS screen — a company's own Google/Tripadvisor review link,
//       configured per company (CompanyRecord.googleReviewUrl /
//       .tripadvisorReviewUrl in src/lib/data/types.ts), asked from the
//       guest app's Review tab.
//   (b) A boat-tour review — a different flow entirely, out of scope here.
// A 5-star rating widget (src/components/guest/GuestReviewScreen.tsx) now
// exists and drives which of the two options below is shown with visual
// EMPHASIS — but never which ones exist. Never gate by rating: every guest
// still gets the same public-review path AND the same private-feedback
// path, fully rendered, clickable, and never `disabled`, at every rating
// value including zero. "Share private feedback instead" is an equal,
// non-hidden option, not a low-rating escape hatch. See
// src/components/guest/GuestReviewScreen.tsx for exactly how that's
// enforced in the UI.
//
// Server Component: resolves the company + review links through the
// DataSource interface (src/lib/data/source.ts), same pattern as
// src/app/(guest)/map/page.tsx, and hands the client component plain props.

import GuestReviewScreen from "@/components/guest/GuestReviewScreen";
import { getActiveCompanyRecord, getCompanyReviewStats } from "@/lib/data/source";
import { getReviewOptions } from "@/lib/guestReview";
import { getGuestContext } from "@/lib/guestServerContext";

export default async function ReviewPage() {
  const { brandId, brand, companyId } = await getGuestContext();

  // getGuestContext() only resolves brand colours + companyId; the review
  // URLs live on the fuller CompanyRecord, so it's fetched again here. Cheap
  // today (in-memory fake store) — see getCompanyRecord's own docs for the
  // note on request-level memoisation once this is a real query.
  //
  // getActiveCompanyRecord (not getCompanyRecord) so a deactivated company's
  // review links stop being served here the moment companyId above goes
  // null, rather than the two disagreeing about whether this tenant exists.
  //
  // No guide is fetched here: the review ask is branded to the COMPANY, not
  // to whichever guide's link the guest arrived on (the guest-facing `Guide`
  // shape in src/lib/types.ts has no `id` for this reason — see
  // src/lib/guestReviewActions.ts for where that decision is enforced).
  const company = await getActiveCompanyRecord(brandId);
  const companyName = company?.name ?? brand.companyName;
  const reviewOptions = getReviewOptions(company, companyName);
  // Real social-proof count (this app's own collected ratings) — null
  // companyId (no real tenant resolved) skips the query entirely rather
  // than asking for stats on nothing. See getCompanyReviewStats' own doc
  // comment for why this is safe (aggregate-only, no PII, same count shown
  // to every guest — not a gating signal).
  const reviewStats = companyId ? await getCompanyReviewStats(companyId) : null;

  return (
    <GuestReviewScreen
      companyName={companyName}
      companyId={companyId}
      reviewOptions={reviewOptions}
      logoUrl={brand.logoUrl}
      reviewCount={reviewStats?.count ?? 0}
    />
  );
}
