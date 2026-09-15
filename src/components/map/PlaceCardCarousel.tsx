"use client";

// Several PlaceCards, swipeable, for places clustered at one map coordinate
// (see src/lib/mapPinClusters.ts — e.g. three boat tours departing the same
// dock). Same native scroll-snap technique as PhotoGallery.tsx, just with a
// full PlaceCard per slide instead of an image, and a dot pill sitting above
// the (opaque, white) card rather than overlaid on it.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PlaceCard, type PlaceCardItem, type PlaceCardProps } from "./PlaceCard";

export interface PlaceCardCarouselProps {
  items: PlaceCardItem[];
  /** Which item to start on — e.g. the specific cruise a clustered pin's tap resolved to. */
  initialId?: string;
  /** Fires whenever the centred slide changes (scroll-settled, not mid-drag). */
  onActiveIdChange?: (id: string) => void;
  isSaved: (id: string) => boolean;
  onToggleSaved: (id: string) => void;
  onClose?: () => void;
  onAction?: PlaceCardProps["onAction"];
  onSecondaryAction?: PlaceCardProps["onSecondaryAction"];
  className?: string;
  style?: CSSProperties;
}

export function PlaceCardCarousel({
  items,
  initialId,
  onActiveIdChange,
  isSaved,
  onToggleSaved,
  onClose,
  onAction,
  onSecondaryAction,
  className,
  style,
}: PlaceCardCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const initialIndex = Math.max(
    0,
    items.findIndex((i) => i.id === initialId),
  );
  const [index, setIndex] = useState(initialIndex);
  const count = items.length;

  // Jump to the requested slide once the track has a real width to scroll
  // against (mount happens with clientWidth 0 on the very first paint) —
  // same reasoning as PhotoGallery's identical effect.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !initialIndex) return;
    el.scrollLeft = initialIndex * el.clientWidth;
    // Only ever on mount — items/initialId identify a fresh cluster
    // selection, which the caller keys a fresh component instance for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth)));
    setIndex((prev) => (prev === next ? prev : next));
  }, [count]);

  useEffect(() => {
    const item = items[index];
    if (item) onActiveIdChange?.(item.id);
    // Re-fires only when the SETTLED index changes, not on every scroll
    // frame — handleScroll already debounces that via rAF-free rounding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (count === 0) return null;

  return (
    <div className={className} style={{ position: "relative", ...style }} aria-roledescription="carousel">
      {count > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 9999,
              background: "rgba(16, 20, 28, 0.75)",
              backdropFilter: "blur(4px)",
            }}
          >
            {items.map((item, i) => (
              <span
                key={item.id}
                aria-hidden="true"
                style={{
                  display: "block",
                  width: i === index ? 16 : 6,
                  height: 6,
                  borderRadius: 9999,
                  background: i === index ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
                  transition: "width 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 220ms ease",
                }}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`.bl-place-carousel::-webkit-scrollbar{display:none;height:0}`}</style>
      <div
        ref={trackRef}
        className="bl-place-carousel"
        onScroll={handleScroll}
        style={{
          display: "flex",
          overflowX: count > 1 ? "auto" : "hidden",
          scrollSnapType: count > 1 ? "x mandatory" : undefined,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              flex: "0 0 100%",
              width: "100%",
              scrollSnapAlign: "center",
              scrollSnapStop: "always",
            }}
          >
            <PlaceCard
              item={item}
              asDrawer
              saved={isSaved(item.id)}
              onToggleSaved={(id) => onToggleSaved(id)}
              onClose={onClose}
              onAction={onAction}
              onSecondaryAction={onSecondaryAction}
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlaceCardCarousel;
