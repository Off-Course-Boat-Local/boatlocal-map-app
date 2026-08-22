"use client";

// One row of a guest list — used by both the List screen (all recommendations,
// filterable) and the Saved screen (grouped by category). Same information
// as a map PlaceCard reduced to list-row shape: a photo, name, one merged
// locator line (area · hours/price), a Book/Directions action, a save
// toggle. Tapping anywhere on the row other than those two controls opens
// GuestPlaceDetail (see onOpenDetail) — the full description + photo grid,
// with the same primary action repeated near the top for a quick tap.
//
// LAYOUT (from the founder's UI audit): the photo is a left rail that
// stretches the FULL height of the row, not a small floating square — the
// old 56px thumbnail in a ~138px row left an L-shaped dead zone under the
// image that read as broken proportion. Title is the sans face at 16px
// (the serif is reserved for ≥22px display sizes — see src/lib/fonts.ts),
// and the CTA + heart both meet the 44px minimum touch target.
//
// DELIBERATE OMISSION, same as PlaceCard: no star rating, no review count,
// anywhere. The guide's note is the endorsement; a list row doesn't even
// have room for it, and that's fine — the full note lives on GuestPlaceDetail,
// this is the index of it.

import { CategoryGlyph } from "@/components/map/Pin";
import { categoryColor } from "@/lib/categories";
import { guestPinActionLabel } from "@/lib/guestActions";
import { bodyFontFamily } from "@/lib/fonts";
import type { MapPin } from "@/lib/data";
import { SaveHeartButton } from "./SaveHeartButton";

const INK = "#17181C";
const MUTED = "#6B7280";
const BORDER = "#E3E4E8";

export interface GuestPlaceRowProps {
  item: MapPin;
  saved: boolean;
  onToggleSaved: () => void;
  onAction: () => void;
  /** Opens the full detail view (photos + description). Optional so existing call sites/tests keep working untouched. */
  onOpenDetail?: () => void;
}

export function GuestPlaceRow({
  item,
  saved,
  onToggleSaved,
  onAction,
  onOpenDetail,
}: GuestPlaceRowProps) {
  const actionLabel = guestPinActionLabel(item);
  const photo = item.photos[0];

  return (
    <li
      onClick={onOpenDetail}
      role={onOpenDetail ? "button" : undefined}
      aria-label={onOpenDetail ? `View details for ${item.name}` : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onKeyDown={
        onOpenDetail
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDetail();
              }
            }
          : undefined
      }
      style={{
        display: "flex",
        gap: 14,
        alignItems: "stretch",
        padding: "12px 16px",
        borderBottom: `1px solid ${BORDER}`,
        fontFamily: bodyFontFamily,
        listStyle: "none",
        cursor: onOpenDetail ? "pointer" : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Photo rail — stretches the full height of the row. */}
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          alignSelf: "stretch",
          width: 92,
          minHeight: 96,
          borderRadius: 14,
          overflow: "hidden",
          background: photo ? "#EDEEF1" : categoryColor(item.category),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <CategoryGlyph category={item.category} size={24} color="#FFFFFF" />
        )}
      </span>

      <div style={{ minWidth: 0, flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-start", justifyContent: "space-between" }}>
          <h3
            style={{
              margin: 0,
              paddingTop: 6,
              fontFamily: bodyFontFamily,
              fontWeight: 600,
              fontSize: 16,
              lineHeight: "21px",
              letterSpacing: "-0.01em",
              color: INK,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </h3>
          <span onClick={(e) => e.stopPropagation()} style={{ margin: "-4px -10px 0 0" }}>
            <SaveHeartButton
              saved={saved}
              label={saved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
              onClick={onToggleSaved}
            />
          </span>
        </div>

        {/* One merged locator line, not two stacked grey lines. Wraps up to
            2 lines (line-clamp) rather than truncating with an ellipsis —
            a real opening-hours string like "Mon–Sat 09:00–17:00, closed
            Sundays" was getting cut off mid-word at a single nowrap line. */}
        <p
          style={{
            margin: "1px 0 0",
            fontSize: 13,
            lineHeight: "18px",
            color: MUTED,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {[item.area, item.meta].filter(Boolean).join(" · ")}
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          style={{
            marginTop: "auto",
            alignSelf: "flex-start",
            height: 44,
            padding: "0 18px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: bodyFontFamily,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
            ...(item.isBoat
              ? { background: "var(--brand-primary)", color: "#FFFFFF", border: "1px solid transparent" }
              : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }),
          }}
        >
          {actionLabel}
        </button>
      </div>
    </li>
  );
}

export default GuestPlaceRow;
