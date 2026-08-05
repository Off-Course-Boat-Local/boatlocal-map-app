// The real guest List screen (PRD §5.3) — the same recommendations as the
// Map, as scrollable rows. See src/components/guest/GuestListScreen.tsx for
// the client-side rendering and src/lib/guestFilterContext.tsx for how its
// category filter stays in sync with the Map tab's.
//
// Server Component: resolves tenant data through the DataSource interface
// (src/lib/data/source.ts), same pattern as src/app/(guest)/map/page.tsx.

import GuestListScreen from "@/components/guest/GuestListScreen";
import { getMapPins } from "@/lib/data/source";
import { getGuestContext } from "@/lib/guestServerContext";

export default async function ListPage() {
  const { brand, companyId, guide } = await getGuestContext();
  const pins = companyId ? await getMapPins(companyId) : [];

  return (
    <GuestListScreen
      brand={brand}
      guideName={guide?.name ?? "your guide"}
      pins={pins}
    />
  );
}
