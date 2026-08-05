"use client";

// One row of a guest list — used by both the List screen (all recommendations,
// filterable) and the Saved screen (grouped by category). Same information
// as a map PlaceCard reduced to list-row shape: icon, name, address (area),
// hours (or duration/price for a boat), a Book/Directions action, a save
// toggle.
//
// DELIBERATE OMISSION, same as PlaceCard: no star rating, no review count,
// anywhere. The guide's note is the endorsement; a list row doesn't even
// have room for it, and that's fine — the note lives on the map card, this
// is the index of it.

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
}

export function GuestPlaceRow({ item, saved, onToggleSaved, onAction }: GuestPlaceRowProps) {
  const actionLabel = guestPinActionLabel(item);

  return (
    <li
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 16px",
        borderBottom: `1px solid ${BORDER}`,
        fontFamily: bodyFontFamily,
        listStyle: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          width: 40,
          height: 40,
          borderRadius: 9999,
          background: categoryColor(item.category),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CategoryGlyph category={item.category} size={18} color="#FFFFFF" />
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
          <SaveHeartButton
            saved={saved}
            label={saved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
            onClick={onToggleSaved}
            size={32}
          />
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
          onClick={onAction}
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
