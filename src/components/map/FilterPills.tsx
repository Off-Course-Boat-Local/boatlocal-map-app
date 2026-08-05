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
const INK = "#17181C";
const BORDER = "#E3E4E8";

export interface FilterPillsProps {
  /** `null` means "All". */
  value: CategoryId | null;
  onChange: (next: CategoryId | null) => void;
  /** Defaults to the full CATEGORIES list. */
  categories?: Category[];
  allLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function FilterPills({
  value,
  onChange,
  categories = CATEGORIES,
  allLabel = "All",
  className,
  style,
}: FilterPillsProps) {
  const pillBase: CSSProperties = {
    flex: "0 0 auto",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 44, // touch target
    padding: "0 16px",
    borderRadius: 9999,
    fontSize: 14,
    lineHeight: 1,
    fontWeight: 500,
    fontFamily: bodyFontFamily,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    transition:
      "background-color 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
  };

  const inactive: CSSProperties = {
    background: "#FFFFFF",
    color: INK,
    border: `1px solid ${BORDER}`,
    boxShadow: "0 1px 2px rgba(16, 20, 28, 0.06)",
  };

  const active: CSSProperties = {
    background: "var(--brand-primary)",
    color: "#FFFFFF",
    border: "1px solid transparent",
    boxShadow: "0 2px 8px rgba(16, 20, 28, 0.16)",
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
        aria-label="Filter places by category"
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
          style={{ ...pillBase, ...(allActive ? active : inactive) }}
        >
          {allLabel}
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
              style={{ ...pillBase, ...(isActive ? active : inactive) }}
            >
              <CategoryGlyph
                category={cat.id}
                size={14}
                color={isActive ? "#FFFFFF" : cat.color}
              />
              {cat.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default FilterPills;
