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

import { useMemo } from "react";

import { GuestPlaceRow } from "./GuestPlaceRow";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { guestPinActionUrl } from "@/lib/guestActions";
import { CATEGORIES } from "@/lib/categories";
import { displayFontFamily } from "@/lib/fonts";
import type { MapPin } from "@/lib/data";
import type { Brand } from "@/lib/types";

export interface GuestSavedScreenProps {
  brand: Brand;
  /** Every pin the guide has for this tenant — filtered down to the saved ids. */
  pins: MapPin[];
}

export default function GuestSavedScreen({ brand, pins }: GuestSavedScreenProps) {
  const { savedIds, isSaved, toggle } = useSavedPlaces();

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

  const openAction = (item: MapPin) => {
    window.open(guestPinActionUrl(item), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="shrink-0 px-4 pb-3 pt-4 text-white"
        style={{ background: "var(--brand-primary)" }}
      >
        <h1 className="text-2xl leading-none" style={{ fontFamily: displayFontFamily }}>
          Saved
        </h1>
        <p className="mt-1 text-xs opacity-80">
          {savedPins.length === 0
            ? `Nothing saved yet from ${brand.appName}`
            : `${savedPins.length} saved from ${brand.appName}`}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {savedPins.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-sm font-medium text-neutral-700">Nothing saved yet</p>
            <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
              Tap the heart on a place or boat tour to keep it here.
            </p>
          </div>
        ) : (
          groups.map(({ category, items }) => (
            <section key={category.id}>
              <h2
                className="px-4 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500"
                style={{ fontFamily: displayFontFamily }}
              >
                {category.label}
              </h2>
              <ul style={{ margin: 0, padding: 0 }}>
                {items.map((item) => (
                  <GuestPlaceRow
                    key={item.id}
                    item={item}
                    saved={isSaved(item.id)}
                    onToggleSaved={() => toggle(item.id)}
                    onAction={() => openAction(item)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
