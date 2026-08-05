"use client";

// Design spike: the three map UI pieces, under all five brands.
//
// This page exists to prove one thing above all — the same components,
// unedited, re-skin correctly when only the CSS custom properties change.
// Flip the brand switcher and watch the pills / buttons / heart move while
// the category pins stay exactly where they are, because category colour is
// semantic, not decorative.

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { BRANDS, brandCssVars } from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import { ALL_PINS, BOAT_TOURS, PLACES } from "@/lib/data";
import type { MapPin } from "@/lib/data";
import type { CategoryId } from "@/lib/types";
import { bodyFontFamily, displayFontFamily, fontVariables } from "@/lib/fonts";
import { Pin } from "@/components/map/Pin";
import { FilterPills } from "@/components/map/FilterPills";
import { PlaceCard } from "@/components/map/PlaceCard";
import type { PlaceCardItem } from "@/components/map/PlaceCard";
import { PhotoGallery } from "@/components/map/PhotoGallery";

const BRAND_ORDER = ["coastal", "coral", "forest", "tulip", "ink"] as const;

const INK = "#17181C";
const MUTED = "#6B7280";
const BORDER = "#E3E4E8";

/** Placeholder for the real map — enough texture to judge pin contrast. */
const FAUX_MAP: CSSProperties = {
  backgroundColor: "#EFEDE6",
  backgroundImage: [
    "linear-gradient(115deg, transparent 46%, #C9DCE8 46%, #C9DCE8 52%, transparent 52%)",
    "linear-gradient(72deg, transparent 30%, #C9DCE8 30%, #C9DCE8 35%, transparent 35%)",
    "linear-gradient(0deg, rgba(0,0,0,0.035) 1px, transparent 1px)",
    "linear-gradient(90deg, rgba(0,0,0,0.035) 1px, transparent 1px)",
  ].join(","),
  backgroundSize: "auto, auto, 28px 28px, 28px 28px",
};

/** Naive equirectangular projection, good enough for a static backdrop. */
function project(
  pins: MapPin[],
): Array<{ pin: MapPin; left: number; top: number }> {
  const lngs = pins.map((p) => p.lng);
  const lats = pins.map((p) => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const spanLng = maxLng - minLng || 1;
  const spanLat = maxLat - minLat || 1;
  return pins.map((pin) => ({
    pin,
    left: 8 + ((pin.lng - minLng) / spanLng) * 84,
    top: 12 + ((maxLat - pin.lat) / spanLat) * 70,
  }));
}

const labelStyle: CSSProperties = {
  margin: 0,
  padding: "10px 16px 0",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: MUTED,
};

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2
        style={{
          margin: 0,
          fontFamily: displayFontFamily,
          fontWeight: 700,
          fontSize: 20,
          color: INK,
        }}
      >
        {title}
      </h2>
      {blurb && (
        <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: "18px", color: MUTED }}>
          {blurb}
        </p>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function Panel({ children, pad = 12 }: { children: ReactNode; pad?: number }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: pad,
      }}
    >
      {children}
    </div>
  );
}

export default function ComponentsSpikePage() {
  const [brandId, setBrandId] = useState<string>("coastal");
  const [filter, setFilter] = useState<CategoryId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>("sunset-canal");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const brand = BRANDS[brandId];

  const visiblePins = useMemo(
    () => (filter ? ALL_PINS.filter((p) => p.category === filter) : ALL_PINS),
    [filter],
  );

  const placed = useMemo(() => project(visiblePins), [visiblePins]);

  const selected = useMemo(
    () => visiblePins.find((p) => p.id === selectedId) ?? null,
    [visiblePins, selectedId],
  );

  const boatSample: PlaceCardItem = {
    ...BOAT_TOURS[0],
    category: "boats",
    meta: BOAT_TOURS[0].meta,
    isBoat: true,
  };

  const placeSample: PlaceCardItem = {
    id: PLACES[2].id,
    name: PLACES[2].name,
    category: PLACES[2].category,
    area: PLACES[2].area,
    note: PLACES[2].note,
    meta: PLACES[2].hours,
    photos: PLACES[2].photos,
    isBoat: false,
  };

  const toggleSaved = (id: string, next: boolean) =>
    setSavedIds((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)));

  return (
    <div
      className={fontVariables}
      style={{
        ...(brandCssVars(brand) as CSSProperties),
        minHeight: "100vh",
        background: "var(--brand-surround)",
        fontFamily: bodyFontFamily,
        color: INK,
      }}
    >
      <div style={{ maxWidth: 375, margin: "0 auto", padding: "20px 16px 64px" }}>
        {/* ---------------------------------------------------------- */}
        {/* Brand switcher                                             */}
        {/* ---------------------------------------------------------- */}
        <header>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 600,
            }}
          >
            Boat Local · component spike
          </p>
          <h1
            style={{
              margin: "6px 0 0",
              fontFamily: displayFontFamily,
              fontWeight: 700,
              fontSize: 28,
              lineHeight: "32px",
              letterSpacing: "-0.02em",
            }}
          >
            Pins, pills &amp; the place card
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: "19px", color: MUTED }}>
            One component set, five skins. Only the CSS custom properties change —
            no component is touched. Category pin colours deliberately do <em>not</em>{" "}
            re-skin.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 14,
            padding: 6,
            background: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflowX: "auto",
          }}
        >
          {BRAND_ORDER.map((id) => {
            const b = BRANDS[id];
            const isActive = id === brandId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setBrandId(id)}
                aria-pressed={isActive}
                title={`${b.companyName} — ${b.appName}`}
                style={{
                  flex: "1 1 0",
                  minWidth: 56,
                  height: 44,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  border: `1px solid ${isActive ? b.primary : "transparent"}`,
                  background: isActive ? `${b.primary}14` : "transparent",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: bodyFontFamily,
                  fontSize: 10,
                  fontWeight: 600,
                  color: isActive ? INK : MUTED,
                  textTransform: "capitalize",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 9999,
                    background: b.primary,
                    boxShadow: `0 0 0 2px ${b.accent}`,
                  }}
                />
                {id}
              </button>
            );
          })}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>
          Active skin: <strong style={{ color: INK }}>{brand.appName}</strong> ·{" "}
          {brand.companyName}
        </p>

        {/* ---------------------------------------------------------- */}
        {/* Live composition                                           */}
        {/* ---------------------------------------------------------- */}
        <Section
          title="All three together"
          blurb="Filter row above the map, pins on it, card on selection. Tap a pin, tap the thumbnail to open the gallery."
        >
          <div
            style={{
              background: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <FilterPills value={filter} onChange={setFilter} />
            <div style={{ position: "relative", height: 460, ...FAUX_MAP }}>
              {placed.map(({ pin, left, top }) => (
                <div
                  key={pin.id}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    top: `${top}%`,
                    // Pin tip is bottom-centre of its own box.
                    transform: "translate(-50%, -100%)",
                    zIndex: pin.id === selectedId ? 10 : 1,
                  }}
                >
                  <Pin
                    category={pin.category}
                    label={pin.name}
                    selected={pin.id === selectedId}
                    onClick={() =>
                      setSelectedId((prev) => (prev === pin.id ? null : pin.id))
                    }
                  />
                </div>
              ))}

              {selected && (
                <PlaceCard
                  key={selected.id}
                  item={selected as PlaceCardItem}
                  bottomOffset={16}
                  saved={savedIds.includes(selected.id)}
                  onToggleSaved={toggleSaved}
                  onClose={() => setSelectedId(null)}
                  onAction={(item) =>
                    // Real handoff lives in mapsHandoff.ts (another agent).
                    console.log(item.isBoat ? "book" : "directions", item.id)
                  }
                />
              )}

              {!selected && (
                <p
                  style={{
                    position: "absolute",
                    left: 16,
                    right: 16,
                    bottom: 16,
                    margin: 0,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.9)",
                    fontSize: 12,
                    color: MUTED,
                    textAlign: "center",
                  }}
                >
                  Tap a pin to open its card.
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Pins — every category, both states                         */}
        {/* ---------------------------------------------------------- */}
        <Section
          title="1 · Category pins"
          blurb="Rest (left) and selected (right) for every category. Fill is the category colour, white stroke, white glyph, soft shadow. Selected adds a translucent halo and scales from the tip."
        >
          <div style={{ borderRadius: 16, overflow: "hidden", ...FAUX_MAP }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 2,
                padding: 8,
              }}
            >
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "14px 4px 10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      gap: 18,
                      minHeight: 56,
                    }}
                  >
                    <Pin category={cat.id} interactive={false} label={cat.label} />
                    <Pin
                      category={cat.id}
                      interactive={false}
                      selected
                      label={`${cat.label}, selected`}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: INK,
                      background: "rgba(255,255,255,0.82)",
                      padding: "2px 8px",
                      borderRadius: 9999,
                    }}
                  >
                    {cat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Filter pills — states                                      */}
        {/* ---------------------------------------------------------- */}
        <Section
          title="2 · Filter pills"
          blurb='Active pill takes --brand-primary. Tapping the active pill toggles back to "All". Scrolls horizontally, scrollbar hidden, nothing wraps or shrinks.'
        >
          <div style={{ display: "grid", gap: 10 }}>
            <Panel pad={0}>
              <p style={labelStyle}>Interactive — current: {filter ?? "All"}</p>
              <FilterPills value={filter} onChange={setFilter} />
            </Panel>
            <Panel pad={0}>
              <p style={labelStyle}>Default state (All)</p>
              <FilterPills value={null} onChange={() => {}} />
            </Panel>
            <Panel pad={0}>
              <p style={labelStyle}>Category active (Boats)</p>
              <FilterPills value="boats" onChange={() => {}} />
            </Panel>
            <Panel pad={0}>
              <p style={labelStyle}>Category active, mid-scroll (Coffee)</p>
              <FilterPills value="coffee" onChange={() => {}} />
            </Panel>
          </div>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Place card — boat vs place                                 */}
        {/* ---------------------------------------------------------- */}
        <Section
          title="3 · Place card"
          blurb="Boat tours get a brand-filled “Book this tour”; everything else gets an outlined “Walking directions”. Subtitle is {area} · {note} for places, {meta} for boats. No ratings — by design."
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <p style={{ ...labelStyle, padding: "0 0 6px" }}>Boat tour</p>
              <PlaceCard
                item={boatSample}
                floating={false}
                saved={savedIds.includes(boatSample.id)}
                onToggleSaved={toggleSaved}
                onClose={() => {}}
              />
            </div>
            <div>
              <p style={{ ...labelStyle, padding: "0 0 6px" }}>Place (saved)</p>
              <PlaceCard
                item={placeSample}
                floating={false}
                saved
                onToggleSaved={() => {}}
                onClose={() => {}}
              />
            </div>
            <div>
              <p style={{ ...labelStyle, padding: "0 0 6px" }}>
                Gallery expanded (thumbnail → swipeable strip)
              </p>
              <PlaceCard
                item={placeSample}
                floating={false}
                galleryOpen
                onToggleGallery={() => {}}
                onClose={() => {}}
              />
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Photo gallery standalone                                   */}
        {/* ---------------------------------------------------------- */}
        <Section
          title="4 · Photo gallery"
          blurb="Native scroll-snap. Swipe on touch, 44px arrows on pointer, dots track position."
        >
          <Panel>
            <PhotoGallery
              photos={PLACES[0].photos}
              alt={`${PLACES[0].name} photo`}
              aspectRatio="4 / 3"
            />
          </Panel>
        </Section>

        <footer style={{ marginTop: 32, fontSize: 12, color: MUTED, lineHeight: "18px" }}>
          <p style={{ margin: 0 }}>
            Brand colour reaches these components only via{" "}
            <code>--brand-primary</code> and friends, written by{" "}
            <code>brandCssVars()</code> onto this page&apos;s wrapper. Grep the
            component files for a hex brand literal — there is none.
          </p>
        </footer>
      </div>
    </div>
  );
}
