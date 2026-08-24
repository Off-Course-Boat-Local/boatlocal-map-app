"use client";

// Horizontally scrollable category filter row that sits above the map.
//
// "All" is always first, then one pill per category. The ACTIVE pill is the
// only brand-coloured element here, and it takes its fill from the
// --brand-primary custom property — never a literal. Everything else is
// neutral chrome or the category's own colour.

import type { CSSProperties } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { Category, CategoryId } from "@/lib/types";
import { bodyFontFamily } from "@/lib/fonts";
import { CategoryGlyph } from "./Pin";

/** Neutral chrome. Deliberately not brand tokens — these never re-skin. */
const MUTED = "#657386";
const BORDER = "#E1E7EE";

export interface FilterPillsProps {
  /** `null` means "All". */
  value: CategoryId | null;
  onChange: (next: CategoryId | null) => void;
  /** Defaults to the full CATEGORIES list. */
  categories?: Category[];
  allLabel?: string;
  /** Accessible group label. Defaults to the English copy; the guest map passes the localized one. */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function FilterPills({
  value,
  onChange,
  categories = CATEGORIES,
  allLabel = "All",
  ariaLabel = "Filter places by category",
  className,
  style,
}: FilterPillsProps) {
  // The BUTTON keeps the full 44px touch target (guests use this one-handed,
  // walking, in the rain); the visual chip is a 36px (h-9) pill inside it,
  // matching the reference design's chip height without shrinking the hit
  // area.
  const buttonBase: CSSProperties = {
    flex: "0 0 auto",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    height: 44, // touch target — never smaller, even though the chip is 36px
    padding: 0,
    border: 0,
    background: "transparent",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  };

  const chipBase: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 36, // h-9, per the reference chip spec
    padding: "0 16px",
    borderRadius: 9999,
    fontSize: 13, // 0.8125rem
    lineHeight: 1,
    fontWeight: 600,
    fontFamily: bodyFontFamily,
    transition:
      "background-color 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
  };

  const inactive: CSSProperties = {
    background: "#FFFFFF",
    color: MUTED,
    border: `1px solid ${BORDER}`,
    boxShadow: "0 1px 2px oklch(0.19 0.03 258 / 6%)",
  };

  const active: CSSProperties = {
    background: "var(--brand-primary)",
    color: "#FFFFFF",
    border: "1px solid var(--brand-primary)",
    boxShadow: "0 2px 8px oklch(0.19 0.03 258 / 16%)",
  };

  const allActive = value === null;

  return (
    <>
      {/* Scrollbar has to go; Tailwind 4 ships no utility for it and
          globals.css is not ours to edit. */}
      <style>{`.bl-pills::-webkit-scrollbar{display:none;height:0}`}</style>
      <div
        className={`bl-pills${className ? ` ${className}` : ""}`}
        role="group"
        aria-label={ariaLabel}
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          padding: "8px 16px",
          ...style,
        }}
      >
        <button
          type="button"
          aria-pressed={allActive}
          onClick={() => onChange(null)}
          style={buttonBase}
        >
          <span style={{ ...chipBase, ...(allActive ? active : inactive) }}>
            {allLabel}
          </span>
        </button>

        {categories.map((cat) => {
          const isActive = value === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={isActive}
              // Tapping the active pill clears back to "All".
              onClick={() => onChange(isActive ? null : cat.id)}
              style={buttonBase}
            >
              <span style={{ ...chipBase, ...(isActive ? active : inactive) }}>
                <CategoryGlyph
                  category={cat.id}
                  size={14}
                  color={isActive ? "#FFFFFF" : cat.color}
                />
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default FilterPills;
