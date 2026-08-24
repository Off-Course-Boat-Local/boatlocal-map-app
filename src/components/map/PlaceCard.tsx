"use client";

// The card that slides up over the map when a pin is selected.
//
// DELIBERATE OMISSION: there are no star ratings, review counts or score
// badges anywhere in this component, and none should be added. The guide's
// note is the endorsement — that is the product. See PRD.
//
// Brand colour reaches this component only through --brand-primary
// (the "Book this tour" fill, the directions arrow, and the saved-heart
// fill). Nothing else here changes when the skin changes.

import { Clock, Heart, MapPin as MapPinIcon, Navigation, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CategoryId } from "@/lib/types";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { PhotoGallery } from "./PhotoGallery";

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
  category: CategoryId;
  area: string;
  note: string;
  /** "90 min · €28 pp" for boats, opening hours for places. */
  meta: string;
  photos: string[];
  isBoat: boolean;
  bookingUrl?: string;
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
  /** Gap from the bottom edge, leaving room for the bottom nav. Default 88. */
  bottomOffset?: number;
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
  className,
  style,
}: PlaceCardProps) {
  const titleId = useId();

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
    rootRef.current?.animate?.(
      [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [item.id]);

  // The guide's note is the endorsement, and the endorsement is the whole
  // product — it is what we chose instead of a crowd-sourced star rating.
  // So it gets its own full-length row and is never clamped. Only the short
  // locator line above it (area, or a boat's duration/price) is muted and
  // truncatable.
  const locator = item.isBoat ? item.meta : item.area;
  const endorsement = item.isBoat ? item.note : item.note;
  const actionLabel = item.isBoat ? "Book this tour" : "Walking directions";

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

  const positioning: CSSProperties = floating
    ? {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: bottomOffset,
        zIndex: 20,
      }
    : { position: "relative" };

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
        ...positioning,
        background: "#FFFFFF",
        borderRadius: 28, // rounded-3xl — bottom-sheet corners
        border: `1px solid ${BORDER}`,
        padding: 20, // ~p-5
        fontFamily: bodyFontFamily,
        color: INK,
        boxShadow: FLOAT_SHADOW,
        ...style,
      }}
    >
      {/* Drag-handle bar — purely decorative bottom-sheet affordance. */}
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

      {/* Close ------------------------------------------------------ */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${item.name}`}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: 0,
            background: "transparent",
            color: MUTED,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <X size={17} strokeWidth={2.1} aria-hidden />
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
                alt={`${item.name} photo`}
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
            aria-label={`Show ${item.photos.length} photos of ${item.name}`}
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
              Hide photos
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
          aria-label={isSaved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
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
