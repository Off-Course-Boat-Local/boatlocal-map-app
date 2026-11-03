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

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import type { CategoryId } from "@/lib/types";
import { BORDER, MUTED } from "@/lib/guestTheme";
import type { MapPin } from "@/lib/data";
import type { Brand, CompanyEvent, Route } from "@/lib/types";
import { GuestEventsSection } from "./GuestEventsSection";
import { GuestRoutesSection } from "./GuestRoutesSection";

export interface GuestListScreenProps {
  brand: Brand;
  guideName: string;
  /** Guide's URL slug — folded into the booking hand-off's `guide` param, same as GuestMapScreen. Null when no guide resolved for this tenant. */
  guideSlug?: string | null;
  /** Guide's real id (not the slug) — attributes "boat_book_click" to this specific guide, not just the company. Null when no guide resolved. */
  guideId?: string | null;
  /** The resolved tenant's real company id — folded into "boat_book_click" analytics. */
  companyId?: string | null;
  /** Where the browse-triggered review drawer's stars lead. Null when no tenant resolved. */
  reviewUrl?: string | null;
  /** Who that drawer is signed by — the guide, else the company. */
  reviewSignature?: string;
  pins: MapPin[];
  /** Boat id -> shared/private + starting price, for the Boats sub-filter and price sort (absent = unknown). */
  boatInfo?: Record<string, { cruiseType: string | null; priceCents: number | null }>;
  routes?: Route[];
  events?: CompanyEvent[];
}

function SubFilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="h-7 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors"
      style={{
        fontFamily: bodyFontFamily,
        cursor: "pointer",
        whiteSpace: "nowrap",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        ...(active
          ? { background: "var(--brand-primary)", color: "#FFFFFF", border: "1px solid var(--brand-primary)" }
          : { background: "#FFFFFF", color: MUTED, border: `1px solid ${BORDER}` }),
      }}
    >
      {children}
    </button>
  );
}

export default function GuestListScreen({
  brand,
  guideName,
  guideSlug,
  guideId,
  companyId,
  reviewUrl,
  reviewSignature,
  pins: allPins,
  boatInfo = {},
  routes = [],
  events = [],
}: GuestListScreenProps) {
  const { filter, setFilter } = useGuestFilter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams?.get("category");
  useEffect(() => {
    if (categoryParam && categoryParam in CATEGORY_MAP) {
      setFilter(categoryParam as CategoryId);
    }
  }, [categoryParam, setFilter]);

  const { isSaved, toggle } = useSavedPlaces();
  const { t } = useI18n();
  const [detailItem, setDetailItem] = useState<MapPin | null>(null);

  function openDetail(item: MapPin) {
    setDetailItem(item);
  }

  // Shared / Private sub-filter, only meaningful while Boats is selected.
  const [boatKind, setBoatKind] = useState<"shared" | "private" | null>(null);
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>(null);
  const pins = useMemo(() => {
    const byCategory = filter ? allPins.filter((p) => p.categories.includes(filter)) : allPins;
    if (filter !== "boats") return byCategory;
    const byKind = boatKind ? byCategory.filter((p) => boatInfo[p.id]?.cruiseType === boatKind) : byCategory;
    if (!priceSort) return byKind;
    const dir = priceSort === "asc" ? 1 : -1;
    // Boats without a known price always sink to the bottom, whichever way we sort.
    return [...byKind].sort((a, b) => {
      const pa = boatInfo[a.id]?.priceCents ?? null;
      const pb = boatInfo[b.id]?.priceCents ?? null;
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return (pa - pb) * dir;
    });
  }, [allPins, filter, boatKind, priceSort, boatInfo]);

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
        subtitle={t.list.recommendationsFrom(allPins.length, guideName)}
        action={<LanguageSwitcher tone="header" />}
        logoUrl={brand.logoUrl}
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

        {filter === "boats" && (
          <div className="flex items-center gap-1.5 px-5 pb-2.5" role="group" aria-label={t.list.boatKindAriaLabel}>
            {[
              { id: null, label: t.common.all },
              { id: "shared" as const, label: t.list.boatShared },
              { id: "private" as const, label: t.list.boatPrivate },
            ].map((opt) => (
              <SubFilterChip
                key={opt.id ?? "all"}
                active={boatKind === opt.id}
                onClick={() => setBoatKind(opt.id)}
              >
                {opt.label}
              </SubFilterChip>
            ))}
            <span className="flex-1" />
            {/* Tap to cycle: off -> price low to high -> high to low -> off. */}
            <SubFilterChip
              active={priceSort !== null}
              onClick={() => setPriceSort(priceSort === null ? "asc" : priceSort === "asc" ? "desc" : null)}
            >
              {t.list.boatSortPrice}{priceSort === "asc" ? " ↑" : priceSort === "desc" ? " ↓" : ""}
            </SubFilterChip>
          </div>
        )}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-white pb-20">
        {!filter && events.length > 0 && (
          <div className="border-b border-[#F1F3F6] pb-2">
            <GuestEventsSection events={events} />
          </div>
        )}

        {!filter && routes.length > 0 && (
          <div className="border-b border-[#F1F3F6] pb-2">
            <GuestRoutesSection routes={routes} />
          </div>
        )}

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
                onOpenDetail={() => openDetail(item)}
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
