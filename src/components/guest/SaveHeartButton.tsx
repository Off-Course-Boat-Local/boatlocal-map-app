"use client";

// The save/unsave heart control, shared by the List, Saved and detail views.
//
// Lucide's Heart — the same icon GuestBottomNav's Saved tab uses, so
// "saved" reads as one consistent mark everywhere it appears.
// Brand-coloured only when active — see src/lib/brand.ts; never a literal
// hex for the filled state.
//
// Two visual variants:
//   - default: a bare 44px hit-area heart (inline rows, detail header).
//   - floating: the reference design's card heart — a 40px translucent
//     white circle with a backdrop blur and card shadow, meant to float
//     over a photo (top-right of GuestPlaceRow's image).

import { Heart } from "lucide-react";

import { INK, SHADOW_CARD } from "@/lib/guestTheme";

export interface SaveHeartButtonProps {
  saved: boolean;
  /** Full accessible label, e.g. "Save Bakers & Roasters" / "Remove Bakers & Roasters from saved". */
  label: string;
  onClick: () => void;
  /** Touch target edge length. Default 44 (Apple/Android minimum) — never pass less. Ignored by `floating`. */
  size?: number;
  /** Translucent white circle for floating over card photos. */
  floating?: boolean;
}

export function SaveHeartButton({
  saved,
  label,
  onClick,
  size = 44,
  floating = false,
}: SaveHeartButtonProps) {
  if (floating) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        className="grid h-10 w-10 place-items-center rounded-full backdrop-blur transition-transform active:scale-95"
        style={{
          background: "rgba(255,255,255,0.85)",
          border: 0,
          padding: 0,
          boxShadow: SHADOW_CARD,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        <Heart
          className="h-5 w-5"
          strokeWidth={1.9}
          color={saved ? "var(--brand-primary)" : INK}
          fill={saved ? "var(--brand-primary)" : "none"}
          aria-hidden
        />
      </button>
    );
  }

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
      <Heart
        size={20}
        strokeWidth={1.9}
        color={saved ? "var(--brand-primary)" : "#9AA0A9"}
        fill={saved ? "var(--brand-primary)" : "none"}
        aria-hidden
      />
    </button>
  );
}

export default SaveHeartButton;
