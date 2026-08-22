"use client";

// The List screen (PRD 5.3) — the same recommendations as the Map, as
// scrollable rows instead of pins. Boats-first order is inherited for free
// from getMapPins() (src/lib/data/source.ts) — the same feed the map uses.
//
// Filter state is shared with the Map screen via GuestFilterProvider
// (src/lib/guestFilterContext.tsx), planted once in src/app/(guest)/layout.tsx,
// so picking "Coffee" here and tapping over to Map keeps showing coffee.
// See that module's header comment for why a Context was the "easy" lift
// rather than URL params or a global store.

import { useMemo, useState } from "react";

import FilterPills from "@/components/map/FilterPills";
import { GuestPlaceDetail } from "./GuestPlaceDetail";
import { GuestPlaceRow } from "./GuestPlaceRow";
import { useGuestFilter } from "@/lib/guestFilterContext";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { guestPinAction } from "@/lib/guestActions";
import { recordGuestEvent } from "@/lib/guestEvents";
import { installPlatformToEventPlatform, detectInstallPlatform } from "@/lib/installPlatform";
import { displayFontFamily } from "@/lib/fonts";
import type { MapPin } from "@/lib/data";
import type { Brand } from "@/lib/types";

export interface GuestListScreenProps {
  brand: Brand;
  guideName: string;
  /** Guide's URL slug — folded into the booking hand-off's `guide` param, same as GuestMapScreen. Null when no guide resolved for this tenant. */
  guideSlug?: string | null;
  /** Guide's real id (not the slug) — attributes "boat_book_click" to this specific guide, not just the company. Null when no guide resolved. */
  guideId?: string | null;
  /** Company subdomain — folded into the booking hand-off's `company` param, and into "boat_book_click" analytics. */
  companyId?: string | null;
  pins: MapPin[];
}

export default function GuestListScreen({
  brand,
  guideName,
  guideSlug,
  guideId,
  companyId,
  pins: allPins,
}: GuestListScreenProps) {
  const { filter, setFilter } = useGuestFilter();
  const { isSaved, toggle } = useSavedPlaces();
  const [detailItem, setDetailItem] = useState<MapPin | null>(null);

  const pins = useMemo(
    () => (filter ? allPins.filter((p) => p.category === filter) : allPins),
    [allPins, filter],
  );

  // Mirrors GuestMapScreen's onAction wiring (companySlug/guideSlug
  // attribution + boat_book_click analytics) so a booking tap from this
  // screen is tracked the same way as one from the Map tab. No trip-date/
  // guest-count picker exists on this screen, so the booking hand-off gets
  // no `selection` — guestPinAction already treats that as "no trip
  // details set" rather than an error.
  const openAction = (item: MapPin) => {
    const { url, clickId } = guestPinAction(item, {
      companySlug: brand.id,
      guideSlug: guideSlug ?? undefined,
    });
    if (item.isBoat) {
      recordGuestEvent({
        eventType: "boat_book_click",
        companyId,
        guideId,
        boatTourId: item.id,
        platform: installPlatformToEventPlatform(
          detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
        ),
        // Same id as the booking URL's `ref` param — see GuestPinAction's
        // doc comment in src/lib/guestActions.ts for why the conversion
        // webhook needs this to match, not just a timestamp-adjacent guess.
        metadata: clickId ? { clickId } : undefined,
      }).catch(() => {});
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="shrink-0 px-4 pb-3 text-white"
        // The brand colour fills behind the status bar in standalone mode
        // (viewport-fit=cover), the text stays below it. env() is 0 in a
        // normal browser tab, leaving the original 16px.
        style={{
          background: "var(--brand-primary)",
          paddingTop: "calc(env(safe-area-inset-top) + 16px)",
        }}
      >
        <h1 className="text-2xl leading-none" style={{ fontFamily: displayFontFamily }}>
          {brand.appName}
        </h1>
        <p className="mt-1 text-xs opacity-80">
          {allPins.length} recommendations from {guideName}
        </p>
      </header>

      <div className="shrink-0 border-b border-neutral-200 bg-white py-2.5">
        <FilterPills value={filter} onChange={setFilter} />
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-white">
        {pins.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-neutral-500">
            No recommendations in this category yet.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0 }}>
            {pins.map((item) => (
              <GuestPlaceRow
                key={item.id}
                item={item}
                saved={isSaved(item.id)}
                onToggleSaved={() => toggle(item.id)}
                onAction={() => openAction(item)}
                onOpenDetail={() => setDetailItem(item)}
              />
            ))}
          </ul>
        )}
      </div>

      {detailItem && (
        <GuestPlaceDetail
          item={detailItem}
          saved={isSaved(detailItem.id)}
          onToggleSaved={() => toggle(detailItem.id)}
          onAction={() => openAction(detailItem)}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}
