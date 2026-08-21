"use client";

// The full-screen detail view behind a tap on a GuestPlaceRow (List/Saved
// screens) — the guide's full note, every photo (as a grid, not just the
// one thumbnail a list row has room for), and the primary action (Book /
// Walking directions) repeated near the TOP of the content so a guest who
// already knows what they want doesn't have to scroll past the description
// first. Tapping any grid photo opens PhotoGallery (src/components/map/
// PhotoGallery.tsx) — the same swipeable full-photo viewer PlaceCard's map
// bottom-sheet already uses — as a full-screen lightbox, jumped to the
// tapped photo via its `initialIndex` prop.
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

import { useState } from "react";

import { guestPinActionLabel } from "@/lib/guestActions";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import type { MapPin } from "@/lib/data";
import { PhotoGallery } from "@/components/map/PhotoGallery";
import { SaveHeartButton } from "./SaveHeartButton";

const INK = "#17181C";
const MUTED = "#6B7280";
const BORDER = "#E3E4E8";

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
  const actionLabel = guestPinActionLabel(item);
  const locator = item.isBoat ? item.meta : item.area;
  const gridPhotos = item.photos.slice(1);

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
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 5 8 12l7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <SaveHeartButton
          saved={saved}
          label={saved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
          onClick={onToggleSaved}
        />
      </div>

      {/* Scrollable content ------------------------------------------ */}
      <div className="no-scrollbar" style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto" }}>
        {item.photos[0] && (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            aria-label={`Show ${item.photos.length} photo${item.photos.length === 1 ? "" : "s"} of ${item.name}`}
            style={{
              display: "block",
              width: "100%",
              padding: 0,
              border: 0,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.photos[0]}
              alt=""
              style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
            />
          </button>
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
              borderRadius: 12,
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
              fontWeight: 700,
              fontSize: 22,
              lineHeight: "27px",
              letterSpacing: "-0.01em",
              color: INK,
            }}
          >
            {item.name}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: "18px", color: MUTED }}>
            {locator}
          </p>

          <p style={{ margin: "14px 0 0", fontSize: 14.5, lineHeight: "21px", color: "#2A2A28" }}>
            {item.note}
          </p>

          {gridPhotos.length > 0 && (
            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
              }}
            >
              {gridPhotos.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setLightboxIndex(i + 1)}
                  aria-label={`Show photo ${i + 2} of ${item.photos.length}`}
                  style={{
                    aspectRatio: "1 / 1",
                    padding: 0,
                    border: 0,
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </button>
              ))}
            </div>
          )}
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
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
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
