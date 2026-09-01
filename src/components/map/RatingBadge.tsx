// Google Places rating/review-count badge — founder call, 2026-09-01,
// reversing what used to be a hard "no rating anywhere" rule (see the
// history in GuestPlaceRow.tsx / PlaceCard.tsx's own comments): a place
// added through Google enrichment carries a rating snapshot
// (RecommendationRecord.googleRating/googleReviewCount), and this renders
// it wherever a guest sees that place. Still shown ALONGSIDE, never
// instead of, the guide's own note — the note stays required regardless.
//
// Renders nothing when `rating` is null (a manually-typed place has no
// Google snapshot to show) — callers don't need their own null-guard.

import { Star } from "lucide-react";
import type { CSSProperties } from "react";

const compactCount = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export interface RatingBadgeProps {
  rating: number | null;
  reviewCount: number | null;
  /** Star + text colour. Defaults to a warm gold that reads on both light chrome and photo overlays. */
  color?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export default function RatingBadge({
  rating,
  reviewCount,
  color = "#B8860B",
  size = 13,
  className,
  style,
}: RatingBadgeProps) {
  if (rating == null) return null;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        color,
        fontWeight: 600,
        ...style,
      }}
    >
      <Star size={size} strokeWidth={0} fill="currentColor" aria-hidden />
      <span>{rating.toFixed(1)}</span>
      {reviewCount != null && reviewCount > 0 ? (
        <span style={{ opacity: 0.7, fontWeight: 500 }}>
          ({compactCount.format(reviewCount)})
        </span>
      ) : null}
    </span>
  );
}
