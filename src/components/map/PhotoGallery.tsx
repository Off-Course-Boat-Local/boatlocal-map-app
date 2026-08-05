"use client";

// Swipeable photo gallery.
//
// Guides upload several photos per place, so the card thumbnail expands into
// this. Implemented with native CSS scroll-snap rather than a carousel
// library: it gives real momentum swiping on iOS, keeps the DOM tiny, and
// degrades to a plain scroller if JS is slow to hydrate.
//
// No brand colour is required here; the dots are neutral-on-photo so they
// stay legible over any image. The only tinted affordance is the active dot,
// which stays white for contrast.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export interface PhotoGalleryProps {
  photos: string[];
  /** Alt text prefix — index is appended, e.g. "Café de Jaren photo 2 of 3". */
  alt?: string;
  /** CSS aspect-ratio for each slide. Default "4 / 3". */
  aspectRatio?: string;
  /** Corner radius in px. Default 12. */
  radius?: number;
  /** Fires whenever the visible slide changes. */
  onIndexChange?: (index: number) => void;
  className?: string;
  style?: CSSProperties;
}

export function PhotoGallery({
  photos,
  alt = "Photo",
  aspectRatio = "4 / 3",
  radius = 12,
  onIndexChange,
  className,
  style,
}: PhotoGalleryProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const count = photos.length;

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.max(
      0,
      Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth)),
    );
    setIndex((prev) => (prev === next ? prev : next));
  }, [count]);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const goTo = useCallback((next: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  }, []);

  if (count === 0) return null;

  const arrow: CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    border: 0,
    background: "rgba(255, 255, 255, 0.86)",
    boxShadow: "0 2px 8px rgba(16, 20, 28, 0.18)",
    color: "#17181C",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  };

  return (
    <div
      className={className}
      style={{ position: "relative", ...style }}
      aria-roledescription="carousel"
    >
      <style>{`.bl-gallery::-webkit-scrollbar{display:none;height:0}`}</style>

      <div
        ref={trackRef}
        className="bl-gallery"
        onScroll={handleScroll}
        style={{
          display: "flex",
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          borderRadius: radius,
          background: "#EDEEF1",
        }}
      >
        {photos.map((src, i) => (
          <div
            key={`${src}-${i}`}
            style={{
              flex: "0 0 100%",
              width: "100%",
              scrollSnapAlign: "center",
              scrollSnapStop: "always",
              aspectRatio,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${alt} ${i + 1} of ${count}`}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                userSelect: "none",
              }}
            />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => goTo(index - 1)}
              style={{ ...arrow, left: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
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
          )}
          {index < count - 1 && (
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => goTo(index + 1)}
              style={{ ...arrow, right: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="m9 5 7 7-7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* Dot indicators. Supplementary to swipe + the 44px arrows. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 8,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 2,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: "4px 6px",
                borderRadius: 9999,
                background: "rgba(16, 20, 28, 0.32)",
                backdropFilter: "blur(4px)",
                pointerEvents: "auto",
              }}
            >
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to photo ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => goTo(i)}
                  style={{
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: 0,
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: i === index ? 16 : 6,
                      height: 6,
                      borderRadius: 9999,
                      background:
                        i === index ? "#FFFFFF" : "rgba(255, 255, 255, 0.55)",
                      transition:
                        "width 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 220ms ease",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PhotoGallery;
