// The real guest map screen. Adapted from src/app/spike/guest/page.tsx
// (left untouched — see src/components/guest/GuestMapScreen.tsx's header
// comment for exactly what changed).
//
// Server Component: resolves tenant data through the DataSource interface
// (src/lib/data/source.ts) and hands it to the client component that
// actually renders the map, so geolocation/MapLibre/interaction stay
// client-side where they must.

import GuestMapScreen from "@/components/guest/GuestMapScreen";
import { getActiveCompanyRecord, getMapPins } from "@/lib/data/source";
import { getReviewOptions } from "@/lib/guestReview";
import { getGuestContext } from "@/lib/guestServerContext";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export default async function MapPage() {
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
    <GuestMapScreen
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
