"use client";

// Category pin — the teardrop marker that sits on the map.
//
// Purely presentational: it knows nothing about MapLibre. The component's
// bounding box is exactly the pin, and the teardrop's point is at
// BOTTOM-CENTRE of that box, so map code positions it with a
// `translate(-50%, -100%)` (or a MapLibre Marker with anchor: "bottom").
//
// COLOUR NOTE: the fill is the *category* colour from @/lib/categories, not a
// brand colour. Categories must read the same across every white-label skin —
// a guest needs to see "that's food, that's a boat" at a glance. The only
// other brand-coloured chrome on the map is the filter pills — and, here,
// the selection halo/pulse below: "you tapped this one" is an app-level
// interaction signal, not a category signal, so it takes `--brand-primary`
// the same way the guest location dot's ping does (see
// src/app/spike/location/page.tsx and GuestDot.tsx).

import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { CATEGORY_MAP, categoryColor } from "@/lib/categories";
import type { CategoryId } from "@/lib/types";

/** The selection halo/pulse colour — brand identity, not category colour. */
const SELECTION_ACCENT = "var(--brand-primary)";

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** Intrinsic viewBox of the teardrop. Rest size is 36 x 44 CSS px. */
const VB_W = 36;
const VB_H = 44;

/** Head circle centre + radius inside the viewBox. */
const HEAD_CX = 18;
const HEAD_CY = 16;
const HEAD_R = 11.5;

/** Tip of the teardrop (the exact coordinate). */
const TIP_Y = 42;

/** Rendered edge length of the glyph inside the pin head (24 x the old 0.625 scale). */
const GLYPH_BOX = 15;

/**
 * Classic map-pin silhouette: a full circle head that tapers into a point.
 * Drawn tip-first so the two flanks are symmetric cubics.
 */
const TEARDROP =
  "M18 42C12.6 32.6 6.5 25.3 6.5 16a11.5 11.5 0 1 1 23 0c0 9.3-6.1 16.6-11.5 26Z";

/** Head centre expressed as % of the box, for positioning the halo. */
const HEAD_CX_PCT = (HEAD_CX / VB_W) * 100;
const HEAD_CY_PCT = (HEAD_CY / VB_H) * 100;
/** Tip expressed as % — the transform origin when the pin scales up. */
const TIP_ORIGIN = `${HEAD_CX_PCT}% ${(TIP_Y / VB_H) * 100}%`;

/* ------------------------------------------------------------------ */
/* CategoryGlyph                                                       */
/* ------------------------------------------------------------------ */

export interface CategoryGlyphProps {
  category: CategoryId;
  /** Rendered edge length in px. Default 14. */
  size?: number;
  /** Any CSS colour. Defaults to `currentColor`. */
  color?: string;
  className?: string;
}

/**
 * The category glyph, standalone — the category's Lucide icon. Used by the
 * pin, the filter pills and anywhere else that needs the category mark.
 * Stroke width leans heavy (2.25) because these render small (14–20px),
 * where Lucide's default 2 starts to thin out.
 */
export function CategoryGlyph({
  category,
  size = 14,
  color = "currentColor",
  className,
}: CategoryGlyphProps) {
  const Icon = CATEGORY_MAP[category]?.glyph;
  if (!Icon) return null;
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={2.25}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Pin                                                                 */
/* ------------------------------------------------------------------ */

export interface PinProps {
  category: CategoryId;
  /** Selected pins grow slightly and gain a translucent halo. */
  selected?: boolean;
  /** Accessible name — normally the place name. */
  label?: string;
  onClick?: () => void;
  /** Rest width in px. Height follows the 36:44 ratio. Default 36. */
  size?: number;
  /** Render as a non-interactive <span> instead of a <button>. */
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Pin({
  category,
  selected = false,
  label,
  onClick,
  size = 36,
  interactive = true,
  className,
  style,
}: PinProps) {
  const color = categoryColor(category);
  const GlyphIcon = CATEGORY_MAP[category]?.glyph;
  const width = size;
  const height = (size * VB_H) / VB_W;

  // Halo sizes are derived from `size` so the pin scales as one piece.
  const glowSize = size * 1.35;
  const ringSize = size * 1.95;

  // Hover/press are local UI feedback, not selection — mirrors the
  // reference guide's `group-hover:-translate-y-0.5` / `active:scale-95`,
  // but expressed as scale-from-the-tip (see TIP_ORIGIN below) rather than
  // a translate, so a hover or a press never nudges the visual tip off the
  // coordinate it marks.
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const liftScale = selected ? 1.14 : hovered ? 1.04 : 1;
  const pressScale = pressed ? 0.95 : 1;
  const bodyScale = liftScale * pressScale;

  const rootStyle: CSSProperties = {
    width,
    height,
    ...style,
  };

  const handlePointerEnter = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") setHovered(true);
  };
  const handlePointerLeave = () => {
    setHovered(false);
    setPressed(false);
  };
  const handlePointerDown = () => setPressed(true);
  const handlePointerUp = () => setPressed(false);

  const body = (
    <>
      {/* Everything that scales together on selection/hover/press, pivoting
          on the tip so the point never leaves the coordinate it marks. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: TIP_ORIGIN,
          transform: `scale(${bodyScale})`,
          transition: pressed
            ? "transform 120ms ease-out"
            : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
      >
        {/* Pulsing selection ring — brand-coloured (not category-coloured):
            "you selected this pin" is an app-identity signal, same role as
            the `animate-ping` dot on the guest's own location marker (see
            src/app/spike/location/page.tsx). Mounted only while selected,
            same as the reference guide's `{active && (...)}`. */}
        {selected ? (
          <span
            aria-hidden="true"
            className="animate-ping"
            style={{
              position: "absolute",
              left: `${HEAD_CX_PCT}%`,
              top: `${HEAD_CY_PCT}%`,
              width: ringSize,
              height: ringSize,
              marginLeft: -ringSize / 2,
              marginTop: -ringSize / 2,
              borderRadius: "50%",
              background: SELECTION_ACCENT,
              opacity: 0.3,
            }}
          />
        ) : null}
        {/* Inner glow — soft, static halo that appears the instant a pin is
            selected (the ping ring above handles the looping pulse). */}
        <span
          style={{
            position: "absolute",
            left: `${HEAD_CX_PCT}%`,
            top: `${HEAD_CY_PCT}%`,
            width: glowSize,
            height: glowSize,
            marginLeft: -glowSize / 2,
            marginTop: -glowSize / 2,
            borderRadius: "50%",
            background: SELECTION_ACCENT,
            opacity: selected ? 0.26 : 0,
            transform: selected ? "scale(1)" : "scale(0.55)",
            transition:
              "opacity 220ms ease-out, transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />

        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width={width}
          height={height}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            overflow: "visible",
            filter: selected
              ? "drop-shadow(0 5px 7px rgba(16, 20, 28, 0.34))"
              : "drop-shadow(0 3px 4px rgba(16, 20, 28, 0.28))",
            transition: "filter 260ms ease-out",
          }}
        >
          <path
            d={TEARDROP}
            fill={color}
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Glyph, centred in the round part of the head. A nested <svg> is
              valid SVG, and Lucide passes x/y/width/height straight through
              to its root element — stroke leans heavy (2.5) because the icon
              draws ~15px tall here, where the default 2 thins out. */}
          {GlyphIcon ? (
            <GlyphIcon
              x={HEAD_CX - GLYPH_BOX / 2}
              y={HEAD_CY - GLYPH_BOX / 2}
              width={GLYPH_BOX}
              height={GLYPH_BOX}
              color="#FFFFFF"
              strokeWidth={2.5}
              aria-hidden="true"
              focusable="false"
            />
          ) : null}
          {/* Faint highlight so the head reads as a dome, not a flat disc. */}
          <circle
            cx={HEAD_CX}
            cy={HEAD_CY}
            r={HEAD_R}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.18}
            strokeWidth={1}
          />
        </svg>
      </span>

      {/* Invisible 44x44 hit area — the artwork is 36px wide, the target is not. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: Math.max(44, width),
          height: Math.max(44, height),
          transform: "translate(-50%, -50%)",
        }}
      />
    </>
  );

  if (!interactive) {
    return (
      <span
        className={className}
        style={{ ...rootStyle, position: "relative", display: "block" }}
        role="img"
        aria-label={label ?? CATEGORY_MAP[category]?.label}
      >
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-pressed={selected}
      aria-label={label ?? CATEGORY_MAP[category]?.label}
      className={className}
      style={{
        ...rootStyle,
        position: "relative",
        display: "block",
        padding: 0,
        border: 0,
        background: "transparent",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {body}
    </button>
  );
}

export default Pin;
