"use client";

// The save/unsave heart control, shared by the List and Saved screens.
//
// Same silhouette as PlaceCard's inline heart (src/components/map/PlaceCard.tsx)
// and GuestBottomNav's SavedGlyph, so "saved" reads as one consistent mark
// everywhere it appears. Brand-coloured only when active — see
// src/lib/brand.ts; never a literal hex for the filled state.

export interface SaveHeartButtonProps {
  saved: boolean;
  /** Full accessible label, e.g. "Save Bakers & Roasters" / "Remove Bakers & Roasters from saved". */
  label: string;
  onClick: () => void;
  /** Touch target edge length. Default 44 (Apple/Android minimum). */
  size?: number;
}

export function SaveHeartButton({ saved, label, onClick, size = 44 }: SaveHeartButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      style={{
        flex: "0 0 auto",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: 0,
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20.4 4.6 13a4.8 4.8 0 0 1 6.8-6.8l.6.6.6-.6A4.8 4.8 0 0 1 19.4 13L12 20.4Z"
          fill={saved ? "var(--brand-primary)" : "none"}
          stroke={saved ? "var(--brand-primary)" : "#9AA0A9"}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export default SaveHeartButton;
