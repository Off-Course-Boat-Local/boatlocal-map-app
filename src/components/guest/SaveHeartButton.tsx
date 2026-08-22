"use client";

// The save/unsave heart control, shared by the List and Saved screens.
//
// Lucide's Heart — the same icon GuestBottomNav's Saved tab uses, so
// "saved" reads as one consistent mark everywhere it appears.
// Brand-coloured only when active — see src/lib/brand.ts; never a literal
// hex for the filled state.

import { Heart } from "lucide-react";

export interface SaveHeartButtonProps {
  saved: boolean;
  /** Full accessible label, e.g. "Save Bakers & Roasters" / "Remove Bakers & Roasters from saved". */
  label: string;
  onClick: () => void;
  /** Touch target edge length. Default 44 (Apple/Android minimum) — never pass less. */
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
