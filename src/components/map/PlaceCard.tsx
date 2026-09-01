"use client";

// The card that slides up over the map when a pin is selected.
//
// RATING: a small Google rating/review-count badge (RatingBadge) renders
// under the title when the item has a googleRating — reverses what used
// to be a hard "no rating anywhere" rule (founder call, 2026-09-01). The
// guide's own note is still the primary endorsement and still required
// regardless of whether a rating is present.
//
// Brand colour reaches this component only through --brand-primary
// (the "Book this tour" fill, the directions arrow, and the saved-heart
// fill). Nothing else here changes when the skin changes.

import { Clock, Heart, MapPin as MapPinIcon, Navigation, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CategoryId } from "@/lib/types";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { PhotoGallery } from "./PhotoGallery";
import RatingBadge from "./RatingBadge";

/* Neutral chrome — never re-skins. */
const INK = "#0B1421";
const MUTED = "#657386";
const BORDER = "#E1E7EE";

/* Upward-projecting float shadow — the card is a bottom sheet hovering over
   the map, so the shadow throws UP, not down. */
const FLOAT_SHADOW =
  "0 -1px 0 oklch(0.19 0.03 258 / 5%), 0 -14px 34px -22px oklch(0.19 0.03 258 / 30%)";

/** Structurally compatible with `MapPin` from @/lib/data. */
export interface PlaceCardItem {
  id: string;
  name: string;
  categories: CategoryId[];
  area: string;
  note: string;
  /** "90 min · €28 pp" for boats, opening hours for places. */
  meta: string;
  photos: string[];
  isBoat: boolean;
  bookingUrl?: string;
  googleRating: number | null;
  googleReviewCount: number | null;
}

export interface PlaceCardProps {
  item: PlaceCardItem;
  /** Heart state. Controlled if provided, otherwise internal. */
  saved?: boolean;
  onToggleSaved?: (id: string, next: boolean) => void;
  onClose?: () => void;
  /** "Book this tour" for boats, "Walking directions" for everything else. */
  onAction?: (item: PlaceCardItem) => void;
  /** Gallery open state. Controlled if provided, otherwise internal. */
  galleryOpen?: boolean;
  onToggleGallery?: (next: boolean) => void;
  /**
   * When true (default) the card positions itself over the bottom of its
   * nearest positioned ancestor — i.e. the map container.
   */
  floating?: boolean;
  /** Gap from the bottom edge, leaving room for the bottom nav. Default 88. Ignored when `asDrawer` is set. */
  bottomOffset?: number;
  /**
   * Drawer chrome: full-width, only its top corners rounded, safe-area
   * padding for the home indicator, no scroll/refresh hand-off, a snappier
   * slide-up entrance, a plainer/bigger close X, and no decorative drag
   * handle. Renders at `position: relative` regardless of `floating` — the
   * CALLER is expected to pin it to the viewport bottom (see GuestMapScreen)
   * so it can stack a distance pill above the card without measuring its
   * dynamic height.
   *
   * Guest map only (founder request, 2026-09-01): the guest map's own
   * bottom nav sits BELOW the map's own container, so the old
   * absolute-within-the-map-box card could never cover it, no matter how
   * small `bottomOffset` got — the caller now escapes that box entirely
   * with its own `position: fixed` wrapper instead. The drag handle is also
   * dropped: it implied a swipe-to-dismiss gesture this card never actually
   * implemented, and swiping down on it with nothing to catch the gesture
   * fell through to the page and triggered the mobile browser's own
   * pull-to-refresh. Closing is via the (now more visible) X only.
   */
  asDrawer?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function PlaceCard({
  item,
  saved,
  onToggleSaved,
  onClose,
  onAction,
  galleryOpen,
  onToggleGallery,
  floating = true,
  bottomOffset = 88,
  asDrawer = false,
  className,
  style,
}: PlaceCardProps) {
  const titleId = useId();
  // Defaults to English when no LocaleProvider is mounted (tests, /spike).
  const { t } = useI18n();

  const [savedInner, setSavedInner] = useState(false);
  const isSaved = saved ?? savedInner;

  const [galleryInner, setGalleryInner] = useState(false);
  const isGalleryOpen = galleryOpen ?? galleryInner;

  // Don't download the full-size photos until the gallery is opened once;
  // after that keep it mounted so the collapse animates both ways.
  //
  // This latches: once opened it stays mounted so the collapse can animate in
  // both directions. Adjusted during render rather than in an effect — this is
  // the documented React pattern for derived state, and an effect here would
  // render the closed state first and then immediately re-render.
  const [galleryMounted, setGalleryMounted] = useState(isGalleryOpen);
  if (isGalleryOpen && !galleryMounted) setGalleryMounted(true);

  // Enter animation, re-played whenever the guest taps a different pin.
  //
  // Driven by the Web Animations API rather than by state: an opacity/transform
  // entrance is presentation only, and routing it through React state costs an
  // extra render of every card for something the compositor can do alone.
  // Optional-chained because jsdom does not implement Element.animate().
  const rootRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // A drawer slides up from off-screen — snappy and quick (180ms, a steep
    // ease-out) rather than the subtler 12px settle a card that's already
    // basically in place uses. Re-plays on every pin tap, drawer or not.
    if (asDrawer) {
      rootRef.current?.animate?.(
        [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
        { duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    } else {
      rootRef.current?.animate?.(
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
  }, [item.id, asDrawer]);

  // The guide's note is the endorsement, and the endorsement is the whole
  // product — it is what we chose instead of a crowd-sourced star rating.
  // So it gets its own full-length row and is never clamped. Only the short
  // locator line above it (area, or a boat's duration/price) is muted and
  // truncatable.
  const locator = item.isBoat ? item.meta : item.area;
  const endorsement = item.isBoat ? item.note : item.note;
  const actionLabel = item.isBoat ? t.common.bookTour : t.common.walkingDirections;

  const toggleSaved = () => {
    const next = !isSaved;
    if (saved === undefined) setSavedInner(next);
    onToggleSaved?.(item.id, next);
  };

  const toggleGallery = () => {
    const next = !isGalleryOpen;
    if (galleryOpen === undefined) setGalleryInner(next);
    onToggleGallery?.(next);
  };

  // A drawer's fixed-to-the-viewport positioning is owned by its caller (so
  // it can stack a distance pill above it without measuring the card's own
  // dynamic height — see GuestMapScreen) — this only ever renders "relative"
  // itself for asDrawer, and contributes the drawer's other chrome (rounded
  // top corners, safe-area padding, no scroll/refresh hand-off) as plain
  // style below instead.
  const positioning: CSSProperties = asDrawer || !floating
    ? { position: "relative" }
    : {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: bottomOffset,
        zIndex: 20,
      };

  const drawerChrome: CSSProperties = asDrawer
    ? {
        // Escaping to the viewport edge means this card now owns the bottom
        // safe area itself — there's no bottom nav under it here to already
        // be absorbing the home indicator.
        paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
        borderRadius: "28px 28px 0 0",
        // Swiping down on this card must scroll/close nothing — it has no
        // scrollable content of its own, and without this a drag here can
        // still be read as the page's own overscroll and hand off to the
        // browser's pull-to-refresh, the exact gesture this mode exists to
        // avoid relying on.
        overscrollBehavior: "none",
        touchAction: "none",
      }
    : {};

  const actionBase: CSSProperties = {
    height: 44,
    borderRadius: 9999, // pills/CTAs are fully rounded in this design language
    fontSize: 15,
    fontWeight: 600,
    fontFamily: bodyFontFamily,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    transition: "background-color 160ms ease, border-color 160ms ease",
  };

  return (
    <section
      ref={rootRef}
      className={className}
      aria-labelledby={titleId}
      style={{
        background: "#FFFFFF",
        borderRadius: 28, // rounded-3xl — bottom-sheet corners; positioning overrides this to top-only for a drawer
        border: `1px solid ${BORDER}`,
        padding: 20, // ~p-5
        fontFamily: bodyFontFamily,
        color: INK,
        boxShadow: FLOAT_SHADOW,
        ...positioning,
        ...drawerChrome,
        ...style,
      }}
    >
      {/* Drag-handle bar — purely decorative bottom-sheet affordance,
          dropped for a drawer: it implied a swipe-to-dismiss gesture this
          card never actually implemented (see asDrawer's doc comment). */}
      {!asDrawer && (
        <span
          aria-hidden="true"
          style={{
            display: "block",
            margin: "0 auto 12px",
            height: 4,
            width: 40,
            borderRadius: 9999,
            background: BORDER,
          }}
        />
      )}

      {/* Close ------------------------------------------------------ */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t.placeDetail.closeItem(item.name)}
          style={{
            position: "absolute",
            top: asDrawer ? 12 : 6,
            right: asDrawer ? 12 : 6,
            width: asDrawer ? 36 : 44,
            height: asDrawer ? 36 : 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: 0,
            borderRadius: 9999,
            // A drawer's X is the ONLY way to close it (no more drag handle
            // hinting a gesture this card never had), so it needs to read
            // as an obvious button rather than bare chrome.
            background: asDrawer ? "#F1F3F6" : "transparent",
            color: MUTED,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <X size={asDrawer ? 18 : 17} strokeWidth={2.1} aria-hidden />
        </button>
      )}

      {/* Expanded gallery ------------------------------------------ */}
      {/* grid-rows 0fr -> 1fr animates height without measuring anything. */}
      <div
        aria-hidden={!isGalleryOpen}
        style={{
          display: "grid",
          gridTemplateRows: isGalleryOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ paddingBottom: 12 }}>
            {galleryMounted && (
              <PhotoGallery
                photos={item.photos}
                alt={t.placeDetail.photoAlt(item.name)}
                aspectRatio="16 / 10"
                radius={16}
              />
            )}
          </div>
        </div>
      </div>

      {/* Header row ------------------------------------------------ */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {!isGalleryOpen && (
          <button
            type="button"
            onClick={toggleGallery}
            aria-expanded={isGalleryOpen}
            aria-label={t.placeDetail.showPhotos(item.photos.length, item.name)}
            style={{
              position: "relative",
              flex: "0 0 auto",
              width: 76,
              height: 76,
              borderRadius: 18, // rounded-2xl thumb, like the reference sheet
              overflow: "hidden",
              padding: 0,
              border: 0,
              background: "#EDF1F5",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.photos[0]}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            {item.photos.length > 1 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: 4,
                  bottom: 4,
                  padding: "1px 6px",
                  borderRadius: 9999,
                  background: "rgba(16, 20, 28, 0.55)",
                  color: "#FFFFFF",
                  fontSize: 10,
                  fontWeight: 600,
                  lineHeight: "14px",
                }}
              >
                {item.photos.length}
              </span>
            )}
          </button>
        )}

        <div style={{ minWidth: 0, flex: "1 1 auto", paddingRight: onClose ? 28 : 0 }}>
          {/* Display face (a geometric sans — see src/lib/fonts.ts), semibold,
              matching the reference sheet's font-display titles. */}
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontFamily: displayFontFamily,
              fontWeight: 600,
              fontSize: 16,
              lineHeight: "22px",
              letterSpacing: "-0.015em",
              color: INK,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.name}
          </h2>
          {item.googleRating != null && (
            <RatingBadge
              rating={item.googleRating}
              reviewCount={item.googleReviewCount}
              size={12}
              style={{ marginTop: 3, fontSize: 12 }}
            />
          )}
          {/* No locator text (e.g. a BoatLocal-synced cruise, whose feed has
              no location name — area is "") means no row at all: an orphaned
              icon with nothing after it reads as a glitch. */}
          {locator.trim() !== "" && (
            <p
              style={{
                margin: "4px 0 0",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                lineHeight: "16px",
                color: MUTED,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.isBoat ? (
                <Clock size={14} strokeWidth={2} aria-hidden style={{ flex: "0 0 auto" }} />
              ) : (
                <MapPinIcon size={14} strokeWidth={2} aria-hidden style={{ flex: "0 0 auto" }} />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{locator}</span>
            </p>
          )}
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13.5,
              lineHeight: "19px",
              color: "#334051",
            }}
          >
            {endorsement}
          </p>
          {isGalleryOpen && (
            <button
              type="button"
              onClick={toggleGallery}
              style={{
                marginTop: 6,
                padding: 0,
                border: 0,
                background: "transparent",
                color: MUTED,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              {t.placeDetail.hidePhotos}
            </button>
          )}
        </div>
      </div>

      {/* Action row ------------------------------------------------ */}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          type="button"
          onClick={() => onAction?.(item)}
          style={{
            ...actionBase,
            flex: "1 1 auto",
            ...(item.isBoat
              ? {
                  background: "var(--brand-primary)",
                  color: "#FFFFFF",
                  border: "1px solid transparent",
                }
              : {
                  background: "#FFFFFF",
                  color: INK,
                  border: `1px solid ${BORDER}`,
                }),
            gap: 8,
          }}
        >
          {!item.isBoat && (
            <Navigation
              size={16}
              strokeWidth={2}
              color="var(--brand-primary)"
              aria-hidden
            />
          )}
          {actionLabel}
        </button>

        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={isSaved}
          aria-label={
            isSaved ? t.common.removeSaved(item.name) : t.common.savePlace(item.name)
          }
          style={{
            ...actionBase,
            flex: "0 0 auto",
            width: 44,
            background: "#FFFFFF",
            border: `1px solid ${isSaved ? "var(--brand-primary)" : BORDER}`,
          }}
        >
          <Heart
            size={20}
            strokeWidth={1.9}
            color={isSaved ? "var(--brand-primary)" : MUTED}
            fill={isSaved ? "var(--brand-primary)" : "none"}
            aria-hidden
          />
        </button>
      </div>
    </section>
  );
}

export default PlaceCard;
