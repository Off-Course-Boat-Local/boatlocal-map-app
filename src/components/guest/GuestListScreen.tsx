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

import { GuestPlaceDetail } from "./GuestPlaceDetail";
import { GuestPlaceRow } from "./GuestPlaceRow";
import { GuestScreenHeader } from "./GuestScreenHeader";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CategoryGlyph } from "@/components/map/Pin";
import { useGuestFilter } from "@/lib/guestFilterContext";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { guestPinAction } from "@/lib/guestActions";
import { recordGuestEvent } from "@/lib/guestEvents";
import { installPlatformToEventPlatform, detectInstallPlatform } from "@/lib/installPlatform";
import { bodyFontFamily } from "@/lib/fonts";
import { CATEGORIES } from "@/lib/categories";
import { BORDER, MUTED } from "@/lib/guestTheme";
import type { MapPin } from "@/lib/data";
import type { Brand } from "@/lib/types";

export interface GuestListScreenProps {
  brand: Brand;
  guideName: string;
  /** Guide's URL slug — folded into the booking hand-off's `guide` param, same as GuestMapScreen. Null when no guide resolved for this tenant. */
  guideSlug?: string | null;
  /** Guide's real id (not the slug) — attributes "boat_book_click" to this specific guide, not just the company. Null when no guide resolved. */
  guideId?: string | null;
  /** The resolved tenant's real company id — folded into "boat_book_click" analytics. */
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
  const { t } = useI18n();
  const [detailItem, setDetailItem] = useState<MapPin | null>(null);

  const pins = useMemo(
    () => (filter ? allPins.filter((p) => p.categories.includes(filter)) : allPins),
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
      <GuestScreenHeader
        eyebrow={brand.companyName}
        title={brand.appName}
        subtitle={t.list.recommendationsFrom(allPins.length, guideName)}
        action={<LanguageSwitcher tone="header" />}
      />

      {/* Category filter chips — same shared filter state as the Map screen
          (useGuestFilter), restyled to the reference's chip row (which tucks
          up under the gradient band with rounded top corners). Tapping the
          active chip clears back to "All", same as FilterPills always did. */}
      <div
        className="-mt-3 shrink-0 rounded-t-2xl bg-white"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div
          className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3"
          role="group"
          aria-label={t.list.filterAriaLabel}
        >
          {[
            { id: null, label: t.common.all, color: undefined },
            // Labels come from the dictionary; ids never translate.
            ...CATEGORIES.map((cat) => ({ id: cat.id, label: t.categories[cat.id], color: cat.color })),
          ].map((cat) => {
            const isActive = filter === cat.id;
            return (
              <button
                key={cat.id ?? "all"}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilter(isActive ? null : cat.id)}
                className="inline-flex items-center gap-1.5 h-9 shrink-0 rounded-full px-4 text-[0.8125rem] font-semibold transition-colors"
                style={{
                  fontFamily: bodyFontFamily,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  ...(isActive
                    ? {
                        background: "var(--brand-primary)",
                        color: "#FFFFFF",
                        border: "1px solid var(--brand-primary)",
                      }
                    : {
                        background: "#FFFFFF",
                        color: MUTED,
                        border: `1px solid ${BORDER}`,
                      }),
                }}
              >
                {cat.id && (
                  <CategoryGlyph
                    category={cat.id}
                    size={14}
                    color={isActive ? "#FFFFFF" : cat.color}
                  />
                )}
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-white">
        {pins.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm" style={{ color: MUTED }}>
            {t.list.emptyCategory}
          </p>
        ) : (
          <ul className="space-y-4 px-5 py-5" style={{ margin: 0 }}>
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
