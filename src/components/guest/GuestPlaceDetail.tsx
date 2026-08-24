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
// DELIBERATE OMISSION, same as PlaceCard/GuestPlaceRow: no star rating, no
// review count. The guide's note is the endorsement.

import { ArrowLeft, Clock, MapPin as MapPinIcon, X } from "lucide-react";
import { useState } from "react";

import { guestPinActionLabel } from "@/lib/guestActions";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import type { MapPin } from "@/lib/data";
import { PhotoGallery } from "@/components/map/PhotoGallery";
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const actionLabel = guestPinActionLabel(item);
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
          aria-label="Back"
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
          label={saved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
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
              alt={`${item.name} photo`}
              aspectRatio="4 / 3"
              radius={0}
              onIndexChange={setHeroIndex}
            />
            <button
              type="button"
              onClick={() => setLightboxIndex(heroIndex)}
              aria-label={`View ${item.photos.length} photo${item.photos.length === 1 ? "" : "s"} of ${item.name} full-screen`}
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
          aria-label={`${item.name} photos`}
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
            aria-label="Close photos"
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
            alt={`${item.name} photo`}
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
