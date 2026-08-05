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

import { useMemo } from "react";

import FilterPills from "@/components/map/FilterPills";
import { GuestPlaceRow } from "./GuestPlaceRow";
import { useGuestFilter } from "@/lib/guestFilterContext";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { guestPinActionUrl } from "@/lib/guestActions";
import { displayFontFamily } from "@/lib/fonts";
import type { MapPin } from "@/lib/data";
import type { Brand } from "@/lib/types";

export interface GuestListScreenProps {
  brand: Brand;
  guideName: string;
  pins: MapPin[];
}

export default function GuestListScreen({ brand, guideName, pins: allPins }: GuestListScreenProps) {
  const { filter, setFilter } = useGuestFilter();
  const { isSaved, toggle } = useSavedPlaces();

  const pins = useMemo(
    () => (filter ? allPins.filter((p) => p.category === filter) : allPins),
    [allPins, filter],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="shrink-0 px-4 pb-3 pt-4 text-white"
        style={{ background: "var(--brand-primary)" }}
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

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
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
                onAction={() => {
                  window.open(guestPinActionUrl(item), "_blank", "noopener,noreferrer");
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
