"use client";

// The full-screen detail view behind a tap on a GuestPlaceRow (List/Saved
// screens) — the guide's full note, every photo, and the primary action
// (Book / Walking directions) repeated near the TOP of the content so a
// guest who already knows what they want doesn't have to scroll past the
// description first.
//
// GALLERY (per the founder's UI audit — "should be able to display the
// gallery more"): the hero IS the swipeable PhotoGallery itself, not a
// static first photo with a separate small thumbnail grid buried below the
// note. Every photo is visible and swipeable right at the top, with dot
// indicators making "there's more than one" obvious at a glance — a small
// expand button opens the same photos full-screen (black background,
// arrows) via PhotoGallery's `initialIndex`, landing on whatever photo the
// guest was already looking at.

import { Expand } from "lucide-react";
//
// Deliberately its own overlay rather than a routed page (no `/place/[id]`
// URL): List/Saved are client-rendered tabs under one guest shell already
// (src/app/(guest)/layout.tsx), and every pin's full data is already in
// memory there — a route would need its own fetch-by-id plumbing for
// nothing this screen actually needs (no deep-linking requirement was
// asked for).
//
// RATING: a small Google rating/review-count badge (RatingBadge) renders
// under the title when the item has a googleRating — same reversal of the
// old "no rating anywhere" rule as PlaceCard/GuestPlaceRow (founder call,
// 2026-09-01). The guide's note is still the primary endorsement.

import { ArrowLeft, Clock, MapPin as MapPinIcon, X } from "lucide-react";
import { useState } from "react";

import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { MapPin } from "@/lib/data";
import { PhotoGallery } from "@/components/map/PhotoGallery";
import RatingBadge from "@/components/map/RatingBadge";
import { SaveHeartButton } from "./SaveHeartButton";

const INK = "#0B1421";
const MUTED = "#657386";
const BORDER = "#E1E7EE";

export interface GuestPlaceDetailProps {
  item: MapPin;
  saved: boolean;
  onToggleSaved: () => void;
  onAction: () => void;
  onClose: () => void;
}

export function GuestPlaceDetail({
  item,
  saved,
  onToggleSaved,
  onAction,
  onClose,
}: GuestPlaceDetailProps) {
  const { t } = useI18n();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const actionLabel = item.isBoat ? t.common.bookTour : t.common.walkingDirections;
  const locator = item.isBoat ? item.meta : item.area;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        fontFamily: bodyFontFamily,
      }}
    >
      {/* Header ------------------------------------------------------ */}
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 52,
          padding: "0 8px",
          borderBottom: `1px solid ${BORDER}`,
          // Fixed inset-0 overlay owns its own safe areas (no shell above it).
          boxSizing: "content-box",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.back}
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: 0,
            background: "transparent",
            color: INK,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <ArrowLeft size={21} strokeWidth={2} aria-hidden />
        </button>
        <SaveHeartButton
          saved={saved}
          label={saved ? t.common.removeSaved(item.name) : t.common.savePlace(item.name)}
          onClick={onToggleSaved}
        />
      </div>

      {/* Scrollable content ------------------------------------------ */}
      <div
        className="no-scrollbar"
        style={{
          minHeight: 0,
          flex: "1 1 auto",
          overflowY: "auto",
          // This overlay is fixed inset-0, so IT owns the bottom safe area
          // (there's no tab bar under it to absorb the home indicator).
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {item.photos.length > 0 && (
          <div style={{ position: "relative" }}>
            <PhotoGallery
              photos={item.photos}
              alt={t.placeDetail.photoAlt(item.name)}
              aspectRatio="4 / 3"
              radius={0}
              onIndexChange={setHeroIndex}
            />
            <button
              type="button"
              onClick={() => setLightboxIndex(heroIndex)}
              aria-label={t.placeDetail.viewPhotosFullScreen(item.photos.length, item.name)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 5,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: 0,
                borderRadius: 9999,
                background: "rgba(16, 20, 28, 0.45)",
                color: "#FFFFFF",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              <Expand size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}

        <div style={{ padding: "16px" }}>
          {/* Primary action, right at the top of the content — a guest who
              already knows they want to book/get directions shouldn't have
              to scroll past the description to do it. */}
          <button
            type="button"
            onClick={onAction}
            style={{
              width: "100%",
              height: 48,
              borderRadius: 9999, // CTAs are fully rounded in this design language
              fontSize: 15,
              fontWeight: 600,
              fontFamily: bodyFontFamily,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
              marginBottom: 16,
              ...(item.isBoat
                ? { background: "var(--brand-primary)", color: "#FFFFFF", border: "1px solid transparent" }
                : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }),
            }}
          >
            {actionLabel}
          </button>

          <h1
            style={{
              margin: 0,
              fontFamily: displayFontFamily,
              fontWeight: 600,
              fontSize: 22,
              lineHeight: "27px",
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            {item.name}
          </h1>
          {item.googleRating != null && (
            <RatingBadge
              rating={item.googleRating}
              reviewCount={item.googleReviewCount}
              size={13}
              style={{ marginTop: 4, fontSize: 13 }}
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
                fontSize: 13,
                lineHeight: "18px",
                color: MUTED,
              }}
            >
              {item.isBoat ? (
                <Clock size={14} strokeWidth={2} aria-hidden style={{ flex: "0 0 auto" }} />
              ) : (
                <MapPinIcon size={14} strokeWidth={2} aria-hidden style={{ flex: "0 0 auto" }} />
              )}
              {locator}
            </p>
          )}

          <p style={{ margin: "14px 0 0", fontSize: 14.5, lineHeight: "21px", color: "#334051" }}>
            {item.note}
          </p>
        </div>
      </div>

      {/* Full-screen photo lightbox ------------------------------------ */}
      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.placeDetail.photosDialogLabel(item.name)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "#000000",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label={t.placeDetail.closePhotos}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 61,
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: 0,
              borderRadius: 9999,
              background: "rgba(255, 255, 255, 0.16)",
              color: "#FFFFFF",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            <X size={17} strokeWidth={2.1} aria-hidden />
          </button>
          <PhotoGallery
            photos={item.photos}
            alt={t.placeDetail.photoAlt(item.name)}
            aspectRatio="1 / 1"
            radius={0}
            initialIndex={lightboxIndex}
          />
        </div>
      )}
    </div>
  );
}

export default GuestPlaceDetail;
