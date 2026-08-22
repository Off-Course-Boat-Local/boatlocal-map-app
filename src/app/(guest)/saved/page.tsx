// The real guest Saved screen (PRD §5.4) — localStorage-persisted, no login.
// See src/lib/savedPlaces.ts for the typed localStorage helpers (saved id
// list, add/remove/toggle) and src/hooks/useSavedPlaces.ts for the React
// binding shared with the Map screen's heart and the bottom nav's badge.
//
// Server Component: only resolves *which pins exist* for this tenant
// (through the DataSource interface, src/lib/data/source.ts) — *which* of
// those are saved is client-only state (localStorage has no server side),
// so src/components/guest/GuestSavedScreen.tsx does that filtering itself.

import GuestSavedScreen from "@/components/guest/GuestSavedScreen";
import { getMapPins } from "@/lib/data/source";
import { getGuestContext } from "@/lib/guestServerContext";

export default async function SavedPage() {
  const { brand, companyId, guide, guideSlug } = await getGuestContext();
  const pins = companyId ? await getMapPins(companyId) : [];

  return (
    <GuestSavedScreen
      brand={brand}
      guideSlug={guide ? guideSlug : null}
      guideId={guide?.id ?? null}
      companyId={companyId}
      pins={pins}
    />
  );
}
