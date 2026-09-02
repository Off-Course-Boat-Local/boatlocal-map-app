// The real guest List screen (PRD §5.3) — the same recommendations as the
// Map, as scrollable rows. See src/components/guest/GuestListScreen.tsx for
// the client-side rendering and src/lib/guestFilterContext.tsx for how its
// category filter stays in sync with the Map tab's.
//
// Server Component: resolves tenant data through the DataSource interface
// (src/lib/data/source.ts), same pattern as src/app/(guest)/map/page.tsx.

import GuestListScreen from "@/components/guest/GuestListScreen";
import { getActiveCompanyRecord, getMapPins } from "@/lib/data/source";
import { getReviewOptions } from "@/lib/guestReview";
import { getGuestContext } from "@/lib/guestServerContext";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export default async function ListPage() {
  const { brand, brandId, companyId, guide, guideSlug } = await getGuestContext();
  const pins = companyId ? await getMapPins(companyId) : [];
  // Where the browse-triggered review drawer's stars lead — the
  // tenant's own configured platform, resolved server-side exactly as
  // the Review screen does it (see (guest)/review/page.tsx).
  const company = await getActiveCompanyRecord(brandId);
  const companyName = company?.name ?? brand.companyName;
  const reviewUrl = getReviewOptions(company, companyName)[0]?.url ?? null;
  // Only the guide-less FALLBACK ("your guide") is app-authored copy; a
  // real guide's name passes through verbatim, never translated.
  const dict = getDictionary(await getLocale());

  return (
    <GuestListScreen
      brand={brand}
      guideName={guide?.name ?? dict.common.yourGuide}
      guideSlug={guide ? guideSlug : null}
      guideId={guide?.id ?? null}
      companyId={companyId}
      reviewUrl={reviewUrl}
      // Signed by the guide who actually shared this, falling back to
      // the company — never the generic "your guide" placeholder.
      reviewSignature={guide?.name ?? companyName}
      pins={pins}
    />
  );
}
