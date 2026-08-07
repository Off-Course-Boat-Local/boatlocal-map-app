"use client";

// One row of a guest list — used by both the List screen (all recommendations,
// filterable) and the Saved screen (grouped by category). Same information
// as a map PlaceCard reduced to list-row shape: a photo, name, address (area),
// hours (or duration/price for a boat), a Book/Directions action, a save
// toggle. Tapping anywhere on the row other than those two controls opens
// GuestPlaceDetail (see onOpenDetail) — the full description + photo grid,
// with the same primary action repeated near the top for a quick tap.
//
// DELIBERATE OMISSION, same as PlaceCard: no star rating, no review count,
// anywhere. The guide's note is the endorsement; a list row doesn't even
// have room for it, and that's fine — the full note lives on GuestPlaceDetail,
// this is the index of it.

import { CategoryGlyph } from "@/components/map/Pin";
import { categoryColor } from "@/lib/categories";
import { guestPinActionLabel } from "@/lib/guestActions";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
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
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 16px",
        borderBottom: `1px solid ${BORDER}`,
        fontFamily: bodyFontFamily,
        listStyle: "none",
        cursor: onOpenDetail ? "pointer" : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          width: 56,
          height: 56,
          borderRadius: 12,
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
          <CategoryGlyph category={item.category} size={20} color="#FFFFFF" />
        )}
      </span>

      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
          <h3
            style={{
              margin: 0,
              fontFamily: displayFontFamily,
              fontWeight: 700,
              fontSize: 16,
              lineHeight: "20px",
              color: INK,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </h3>
          <span onClick={(e) => e.stopPropagation()}>
            <SaveHeartButton
              saved={saved}
              label={saved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
              onClick={onToggleSaved}
              size={32}
            />
          </span>
        </div>

        <p
          style={{
            margin: "2px 0 0",
            fontSize: 12.5,
            lineHeight: "17px",
            color: MUTED,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.area}
        </p>
        <p
          style={{
            margin: "1px 0 0",
            fontSize: 12.5,
            lineHeight: "17px",
            color: MUTED,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.meta}
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          style={{
            marginTop: 8,
            height: 36,
            padding: "0 14px",
            borderRadius: 10,
            fontSize: 13,
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
