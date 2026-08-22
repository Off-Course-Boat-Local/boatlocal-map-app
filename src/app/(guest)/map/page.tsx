// The real guest map screen. Adapted from src/app/spike/guest/page.tsx
// (left untouched — see src/components/guest/GuestMapScreen.tsx's header
// comment for exactly what changed).
//
// Server Component: resolves tenant data through the DataSource interface
// (src/lib/data/source.ts) and hands it to the client component that
// actually renders the map, so geolocation/MapLibre/interaction stay
// client-side where they must.

import GuestMapScreen from "@/components/guest/GuestMapScreen";
import { getMapPins } from "@/lib/data/source";
import { getGuestContext } from "@/lib/guestServerContext";

export default async function MapPage() {
  const { brand, companyId, guide, guideSlug } = await getGuestContext();
  const pins = companyId ? await getMapPins(companyId) : [];

  return (
    <GuestMapScreen
      brand={brand}
      guideName={guide?.name ?? "your guide"}
      guideSlug={guide ? guideSlug : null}
      guideId={guide?.id ?? null}
      companyId={companyId}
      pins={pins}
    />
  );
}
