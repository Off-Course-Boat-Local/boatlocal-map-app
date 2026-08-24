"use client";

// The Saved screen (PRD 5.4) — localStorage-persisted, no login (see
// src/lib/savedPlaces.ts for why and exactly how). Grouped by category,
// Boats first: CATEGORIES (src/lib/categories.ts) already lists "boats"
// first for this exact reason, so grouping in that array's order gives the
// right order for free rather than re-encoding it here.
//
// The badge count a guest sees on the bottom nav's "Saved" tab
// (src/components/guest/GuestBottomNav.tsx) comes from the same
// useSavedPlaces() hook this screen uses, so the two can never disagree.

import { useMemo, useState } from "react";

import { GuestPlaceDetail } from "./GuestPlaceDetail";
import { GuestPlaceRow } from "./GuestPlaceRow";
import { GuestScreenHeader } from "./GuestScreenHeader";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { guestPinAction } from "@/lib/guestActions";
import { recordGuestEvent } from "@/lib/guestEvents";
import { installPlatformToEventPlatform, detectInstallPlatform } from "@/lib/installPlatform";
import { CATEGORIES } from "@/lib/categories";
import { bodyFontFamily } from "@/lib/fonts";
import { BORDER, INK, MUTED } from "@/lib/guestTheme";
import type { MapPin } from "@/lib/data";
import type { Brand } from "@/lib/types";

export interface GuestSavedScreenProps {
  brand: Brand;
  /** Guide's URL slug — folded into the booking hand-off's `guide` param, same as GuestMapScreen. Null when no guide resolved for this tenant. */
  guideSlug?: string | null;
  /** Guide's real id (not the slug) — attributes "boat_book_click" to this specific guide, not just the company. Null when no guide resolved. */
  guideId?: string | null;
  /** The resolved tenant's real company id — folded into "boat_book_click" analytics. */
  companyId?: string | null;
  /** Every pin the guide has for this tenant — filtered down to the saved ids. */
  pins: MapPin[];
}

export default function GuestSavedScreen({
  brand,
  guideSlug,
  guideId,
  companyId,
  pins,
}: GuestSavedScreenProps) {
  const { savedIds, isSaved, toggle } = useSavedPlaces();
  const [detailItem, setDetailItem] = useState<MapPin | null>(null);

  const savedPins = useMemo(() => {
    const savedSet = new Set(savedIds);
    // Preserve pins' own (boats-first) order rather than save order, so a
    // guide's featured boats stay at the top of Saved too, not wherever the
    // guest happened to tap the heart first.
    return pins.filter((p) => savedSet.has(p.id));
  }, [pins, savedIds]);

  const groups = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        items: savedPins.filter((p) => p.category === category.id),
      })).filter((group) => group.items.length > 0),
    [savedPins],
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
        // Same id as the booking URL's `ref` param — lets the BoatLocal
        // conversion webhook find this exact click. See GuestPinAction's
        // doc comment in guestActions.ts.
        metadata: clickId ? { clickId } : undefined,
      }).catch(() => {});
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex h-full w-full flex-col">
      <GuestScreenHeader
        eyebrow="Your shortlist"
        title="Saved"
        subtitle={
          savedPins.length === 0
            ? `Nothing saved yet from ${brand.appName}`
            : `${savedPins.length} saved from ${brand.appName}`
        }
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-white">
        {savedPins.length === 0 ? (
          <div className="px-5 py-10">
            <div
              className="rounded-2xl px-6 py-12 text-center"
              style={{ border: `1px dashed ${BORDER}` }}
            >
              <p className="text-base font-medium" style={{ color: INK }}>
                Nothing saved yet
              </p>
              <p
                className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed"
                style={{ color: MUTED, fontFamily: bodyFontFamily }}
              >
                Tap the heart on a place or boat tour to keep it here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-7 px-5 py-6">
            {groups.map(({ category, items }) => (
              <section key={category.id}>
                <h2
                  className="mb-3 flex items-baseline gap-2 text-[0.8125rem] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: MUTED, fontFamily: bodyFontFamily }}
                >
                  {category.label}
                  <span aria-hidden="true" style={{ color: "var(--brand-primary)" }}>
                    {items.length}
                  </span>
                </h2>
                <ul className="space-y-4" style={{ margin: 0, padding: 0 }}>
                  {items.map((item) => (
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
              </section>
            ))}
          </div>
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
