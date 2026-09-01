"use client";

// One card of a guest feed — used by both the List screen (all
// recommendations, filterable) and the Saved screen (grouped by category).
// This is the reference design's RecommendationCard shape (nice-notice's
// src/components/recommendation-card.tsx): a rounded-2xl card with a
// full-width photo on top, a floating save heart over the photo, then a
// content block with title, the guide's note as a two-line blurb, a small
// icon metadata row, and a footer with the (boat) price line and the primary
// CTA. Tapping anywhere on the card other than the heart/CTA opens
// GuestPlaceDetail (see onOpenDetail) — the full description + photo grid,
// with the same primary action repeated near the top for a quick tap.
//
// RATING: a small Google rating/review-count badge (RatingBadge) renders
// next to the title when googleRating is set — reverses what used to be a
// hard "no rating anywhere" rule (founder call, 2026-09-01). The guide's
// note is still the primary endorsement and is still required regardless
// (that's what the blurb below is); the full note lives on
// GuestPlaceDetail, this is the index of it.
//
// DATA MAPPING (reference → MapPin): image → photos[0] (brand-tint
// placeholder with the category glyph when a place has no photo yet);
// blurb → note; distance row → area; duration/price → meta ("90 min ·
// €28 pp" for boats — shown as the footer price line — opening hours for
// places, shown in the metadata row).

import { Clock, MapPin as MapPinIcon } from "lucide-react";

import { CategoryGlyph } from "@/components/map/Pin";
import RatingBadge from "@/components/map/RatingBadge";
import { categoryColor } from "@/lib/categories";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { BORDER, BRAND_TINT, INK, MUTED, SHADOW_CARD } from "@/lib/guestTheme";
import { relativeHoursLabel } from "@/lib/hoursFormat";
import type { MapPin } from "@/lib/data";
import { SaveHeartButton } from "./SaveHeartButton";

const CLAMP_2 = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
} as const;

export interface GuestPlaceRowProps {
  item: MapPin;
  saved: boolean;
  onToggleSaved: () => void;
  onAction: () => void;
  /** Opens the full detail view (photos + description). Optional so existing call sites/tests keep working untouched. */
  onOpenDetail?: () => void;
}

export function GuestPlaceRow({
  item,
  saved,
  onToggleSaved,
  onAction,
  onOpenDetail,
}: GuestPlaceRowProps) {
  const { t } = useI18n();
  const actionLabel = item.isBoat ? t.common.bookTour : t.common.walkingDirections;
  const photo = item.photos[0];

  return (
    <li
      onClick={onOpenDetail}
      role={onOpenDetail ? "button" : undefined}
      aria-label={onOpenDetail ? t.list.viewDetails(item.name) : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onKeyDown={
        onOpenDetail
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDetail();
              }
            }
          : undefined
      }
      className="overflow-hidden rounded-2xl"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        boxShadow: SHADOW_CARD,
        fontFamily: bodyFontFamily,
        listStyle: "none",
        cursor: onOpenDetail ? "pointer" : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div className="relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            loading="lazy"
            className="h-44 w-full object-cover"
            style={{ display: "block" }}
          />
        ) : (
          // Graceful placeholder for a place without a photo yet — the soft
          // brand tint with the category's own glyph, so the card keeps its
          // proportions and still reads at a glance.
          <div
            aria-hidden="true"
            className="grid h-44 w-full place-items-center"
            style={{ background: BRAND_TINT }}
          >
            <CategoryGlyph
              category={item.categories[0]}
              size={32}
              color={categoryColor(item.categories[0])}
            />
          </div>
        )}
        <span
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 top-3"
        >
          <SaveHeartButton
            floating
            saved={saved}
            label={saved ? t.common.removeSaved(item.name) : t.common.savePlace(item.name)}
            onClick={onToggleSaved}
          />
        </span>
      </div>

      <div className="p-4">
        <h3
          className="text-[1.0625rem] font-semibold leading-snug"
          style={{ ...CLAMP_2, margin: 0, color: INK, fontFamily: displayFontFamily }}
        >
          {item.name}
        </h3>
        {item.googleRating != null && (
          <RatingBadge
            rating={item.googleRating}
            reviewCount={item.googleReviewCount}
            className="mt-1"
            style={{ fontSize: "0.75rem" }}
          />
        )}
        {item.note && (
          <p
            className="mt-1.5 text-[0.8125rem] leading-relaxed"
            style={{ ...CLAMP_2, color: MUTED }}
          >
            {item.note}
          </p>
        )}

        {/* BoatLocal-synced cruises carry no location name at all (area is
            ""), and a pin icon with nothing after it reads as a glitch — so
            the locator only renders when there's a name to locate. The whole
            metadata row (with its mt-3) disappears when it would be empty:
            a zero-height flex row still stacks its own top margin above the
            footer's, leaving a visible dead gap between blurb and footer.
            A boat's DURATION ALONE (item.durationLabel, e.g. "1 hour & 30
            mins") lives here — small, muted, clock-iconed, matching
            PlaceCard.tsx's locator line — while its PRICE goes in the bold
            footer line below, not here: showing "1 hour · from €15 pp"
            all in one small line read as visually flat with no price
            emphasis; showing the whole combined string bold in the footer
            read as oversized. Splitting them is the founder's own call
            after seeing both. `durationLabel`/`priceLabel` are null for an
            admin-curated tour with no BoatLocal sync data — `item.meta`
            (the old combined string) is the fallback for that case, shown
            here in full so nothing is lost, just not split. */}
        {(item.area.trim() !== "" || item.durationLabel || (!item.durationLabel && item.meta)) && (
          <div
            className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.75rem]"
            style={{ color: MUTED }}
          >
            {item.area.trim() !== "" && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5" aria-hidden />
                {item.area}
              </span>
            )}
            {(item.durationLabel || item.meta) && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {/* Boats: item.meta is a duration/price string, shown
                    verbatim. Places: item.meta is opening hours — reduced
                    to a single relative-to-now line ("Closes in 45m")
                    instead of the whole week, falling back to the raw
                    text unchanged for anything relativeHoursLabel can't
                    parse (guide-entered free text like "Always open"). */}
                {item.durationLabel || relativeHoursLabel(item.meta)}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          {item.priceLabel ? (
            <p
              className="text-[1.0625rem] font-bold"
              style={{ margin: 0, color: INK, fontFamily: displayFontFamily }}
            >
              {item.priceLabel}
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
            className="inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[0.8125rem] font-semibold transition-transform active:scale-[0.98]"
            style={{
              fontFamily: bodyFontFamily,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
              ...(item.isBoat
                ? {
                    background: "var(--brand-primary)",
                    color: "#FFFFFF",
                    border: "1px solid transparent",
                  }
                : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }),
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </li>
  );
}

export default GuestPlaceRow;
