"use client";

// Spike page for the location + directions layer.
//
// Deliberately map-free: the map is owned by another agent, and everything on
// this page must be judgeable without it. What is being proven here:
//   1. all four LocationState arms render as finished UI, including denied;
//   2. the padded walking numbers are plausible for real Amsterdam pairs;
//   3. the Google Maps hand-off URL is correct and clickable;
//   4. the dotted line reads as "approximate", not "follow this".

import { useSyncExternalStore } from "react";
import {
  DIRECTION_LINE_DASHARRAY,
  DIRECTION_LINE_WIDTH,
  readBrandPrimary,
} from "@/components/map/DirectionLine";
import { guestPoint, useGuestLocation } from "@/hooks/useGuestLocation";
import { DEFAULT_BRAND, brandCssVars } from "@/lib/brand";
import { CATEGORY_MAP } from "@/lib/categories";
import { ALL_PINS, FALLBACK_GUEST_POSITION, GUIDE, PLACES } from "@/lib/data";
import {
  AMSTERDAM_DETOUR_FACTOR,
  LONG_WALK_METERS,
  formatWalk,
  formatWalkFromMeters,
  haversineMeters,
  walkCaveatFor,
  walkingDistanceMeters,
} from "@/lib/distance";
import {
  DIRECTIONS_LINK_PROPS,
  directionsAriaLabel,
  directionsButtonLabel,
  googleMapsWalkingUrl,
} from "@/lib/mapsHandoff";
import type { LocationState } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-black/10 pt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
        {title}
      </h2>
      {blurb ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60">
          {blurb}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** The dotted-line glyph that sits next to the distance string on a card. */
function DottedGlyph() {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
      <line
        x1="2"
        y1="4"
        x2="20"
        y2="4"
        stroke="var(--brand-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="0 6"
      />
    </svg>
  );
}

function PinDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full ring-2 ring-white"
      style={{ background: color }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* 1. The four location states                                         */
/* ------------------------------------------------------------------ */

/**
 * The status strip that sits above the map. Its whole job is to make every
 * state look intentional. Note there is no state in which it shouts.
 */
function LocationStatusStrip({
  state,
  onRetry,
}: {
  state: LocationState;
  onRetry?: () => void;
}) {
  if (state.status === "granted") {
    const rough = state.accuracy > 100;
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-black/[0.04] px-3.5 py-2.5 text-sm">
        <span className="relative flex size-3">
          <span className="absolute inline-flex size-3 animate-ping rounded-full bg-[var(--brand-primary)] opacity-40" />
          <span className="relative inline-flex size-3 rounded-full bg-[var(--brand-primary)] ring-2 ring-white" />
        </span>
        <span className="text-black/75">
          {rough ? "Rough location" : "You're here"}
        </span>
        <span className="text-black/40">
          ±{Math.round(state.accuracy)} m
        </span>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-black/[0.04] px-3.5 py-2.5 text-sm">
        <span className="size-3 animate-pulse rounded-full bg-black/25" />
        <span className="text-black/55">Finding you…</span>
      </div>
    );
  }

  // denied / unavailable — one quiet line, one optional action. No icon-heavy
  // warning, no red, no modal. Nothing is broken; we just know less.
  const copy =
    state.status === "denied"
      ? "Location is off — distances are hidden"
      : "Can't get your location right now";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-black/[0.04] px-3.5 py-2.5 text-sm">
      <span className="size-3 rounded-full border-2 border-dashed border-black/25" />
      <span className="text-black/55">{copy}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline"
        >
          {state.status === "denied" ? "How to enable" : "Try again"}
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Place card, with and without a location                          */
/* ------------------------------------------------------------------ */

type DemoPin = (typeof ALL_PINS)[number];

function PlaceCardMock({
  pin,
  guest,
}: {
  pin: DemoPin;
  guest: { lng: number; lat: number } | null;
}) {
  const category = CATEGORY_MAP[pin.category];
  const place = PLACES.find((p) => p.id === pin.id);
  const url = googleMapsWalkingUrl({
    destLat: pin.lat,
    destLng: pin.lng,
    destName: pin.name,
  });

  return (
    <article className="w-full max-w-[360px] overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.10)] ring-1 ring-black/5">
      {/* Photo stands in for PhotoGallery, which another agent owns. */}
      <div
        className="h-36 w-full"
        style={{
          background: `linear-gradient(135deg, ${category.color}33, ${category.color}88)`,
        }}
      />

      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-[17px] font-semibold leading-tight text-black/90">
            {pin.name}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-black/50">
            <PinDot color={category.color} />
            {category.label} · {pin.area}
          </p>
          {place ? (
            <p className="mt-0.5 text-[13px] text-black/45">{place.address}</p>
          ) : null}
        </div>

        {/* ---- distance row: present only when we know where the guest is ---- */}
        {guest ? (
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--brand-primary)]">
              <DottedGlyph />
              {formatWalk(guest, pin)}
            </p>
            <p className="mt-0.5 pl-[30px] text-[11.5px] leading-snug text-black/40">
              {walkCaveatFor(guest, pin)}
            </p>
          </div>
        ) : (
          /* ---- the no-location substitute: quiet, one line, dismissible ----
             It occupies roughly the same space as the distance row so the card
             does not visibly collapse, but it never nags. */
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg bg-black/[0.035] px-2.5 py-2 text-left text-[13px] text-black/50 transition hover:bg-black/[0.06]"
          >
            <span className="size-2.5 shrink-0 rounded-full border-[1.5px] border-dashed border-black/30" />
            <span>
              Turn on location to see how far this is
            </span>
            <span className="ml-auto shrink-0 text-[12px] font-semibold text-[var(--brand-primary)]">
              Enable
            </span>
          </button>
        )}

        {/* The guide's note — the actual product. Always present, in every
            location state. This is why the card still feels complete. */}
        <div className="flex gap-2.5 rounded-lg bg-black/[0.035] p-3">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: "var(--brand-primary)" }}
          >
            {GUIDE.avatarInitial}
          </span>
          <p className="text-[13.5px] leading-snug text-black/70">
            “{pin.note}”
          </p>
        </div>

        <p className="text-[12.5px] text-black/50">{pin.meta}</p>

        <a
          href={url}
          aria-label={directionsAriaLabel(pin.name)}
          {...DIRECTIONS_LINK_PROPS}
          className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold text-white"
          style={{ background: "var(--brand-primary)" }}
        >
          {directionsButtonLabel(pin.name)}
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 17 17 7M9 7h8v8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* 3. SVG mock of the dotted line                                      */
/* ------------------------------------------------------------------ */

/**
 * A stand-in for the MapLibre layer so the dash pattern can be judged without
 * the map. The SVG `stroke-dasharray="0 N"` + round cap trick is the exact
 * same construction as `line-dasharray: [0, 2]` with `line-cap: round`, where
 * MapLibre's units are multiples of line width.
 */
function DottedLineMock() {
  const gap = DIRECTION_LINE_DASHARRAY[1] * DIRECTION_LINE_WIDTH; // 2 × 4 = 8px

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 560 220"
        className="w-full min-w-[520px] rounded-xl"
        role="img"
        aria-label="Mock of the dotted direction line crossing a canal with no bridge nearby"
      >
        <rect x="0" y="0" width="560" height="220" fill="#EDE9E1" />
        {/* blocks */}
        <rect x="0" y="0" width="560" height="70" fill="#E2DDD2" />
        <rect x="0" y="122" width="560" height="98" fill="#E2DDD2" />
        {/* a gracht with exactly one bridge, well off the straight line */}
        <rect x="0" y="70" width="560" height="52" fill="#BFD6E4" />
        <rect x="452" y="66" width="34" height="60" fill="#E2DDD2" />
        <text x="469" y="60" fontSize="9" fill="#7c7566" textAnchor="middle">
          bridge
        </text>

        {/* the dotted line — straight, honest, and clearly not a route */}
        <line
          x1="86"
          y1="176"
          x2="470"
          y2="42"
          stroke="var(--brand-primary)"
          strokeWidth={DIRECTION_LINE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`0 ${gap}`}
          opacity="0.85"
        />

        {/* guest dot with accuracy halo */}
        <circle cx="86" cy="176" r="17" fill="var(--brand-primary)" opacity="0.16" />
        <circle cx="86" cy="176" r="6.5" fill="var(--brand-primary)" stroke="#fff" strokeWidth="2.5" />

        {/* destination pin */}
        <g transform="translate(470 42)">
          <path
            d="M0 6c-7-9-11-13-11-19a11 11 0 0 1 22 0c0 6-4 10-11 19z"
            transform="translate(0 -6)"
            fill="#7B4FBF"
            stroke="#fff"
            strokeWidth="2"
          />
          <circle cx="0" cy="-19" r="3.6" fill="#fff" />
        </g>

        <text x="104" y="200" fontSize="11" fill="#5f5a4f">
          you
        </text>
        <text x="470" y="20" fontSize="11" fill="#5f5a4f" textAnchor="middle">
          Rijksmuseum
        </text>
      </svg>
    </div>
  );
}

/** Side-by-side so the "dotted vs solid" argument is visible, not just written. */
function DashComparison() {
  const rows: Array<{ label: string; dash: string; note: string }> = [
    {
      label: "Ours — dasharray [0, 2], round cap",
      dash: `0 ${DIRECTION_LINE_DASHARRAY[1] * DIRECTION_LINE_WIDTH}`,
      note: "Reads as “that way, about this far”.",
    },
    {
      label: "Dashed — dasharray [2, 2]",
      dash: `${2 * DIRECTION_LINE_WIDTH} ${2 * DIRECTION_LINE_WIDTH}`,
      note: "Starts to look like a path. Rejected.",
    },
    {
      label: "Solid",
      dash: "none",
      note: "Reads as “follow this”. Over-promises. Rejected.",
    },
  ];

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <svg width="200" height="16" aria-hidden="true" className="shrink-0">
            <line
              x1="4"
              y1="8"
              x2="196"
              y2="8"
              stroke="var(--brand-primary)"
              strokeWidth={DIRECTION_LINE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={r.dash === "none" ? undefined : r.dash}
              opacity="0.85"
            />
          </svg>
          <span className="text-sm text-black/75">{r.label}</span>
          <span className="text-sm text-black/45">{r.note}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const SAMPLE_IDS = [
  "screaming-beans",
  "nine-streets",
  "anne-frank",
  "waterlooplein",
  "rijksmuseum",
  "foodhallen",
  "bakers-roasters",
  "brouwerij-ij",
  "ndsm-werf",
];

const ALL_STATES: LocationState[] = [
  { status: "loading" },
  { status: "granted", lng: 4.8936, lat: 52.3731, accuracy: 18 },
  { status: "denied" },
  { status: "unavailable" },
];

export default function LocationSpikePage() {
  // Simulated so the spike is usable on a desktop, where real geolocation is
  // either absent or a kilometre out.
  const { location, reason, isSimulated, request } = useGuestLocation({
    simulate: true,
  });
  const guest = guestPoint(location);

  // Read during render (client only) rather than pushed in from an effect.
  const resolvedPrimary = useSyncExternalStore(
    () => () => {},
    () => readBrandPrimary(),
    () => "",
  );

  const samples = SAMPLE_IDS.map(
    (id) => ALL_PINS.find((p) => p.id === id)!,
  ).filter(Boolean);

  const demoPin = ALL_PINS.find((p) => p.id === "anne-frank")!;
  const longWalkPin = ALL_PINS.find((p) => p.id === "ndsm-werf")!;
  const demoUrl = googleMapsWalkingUrl({
    destLat: demoPin.lat,
    destLng: demoPin.lng,
    destName: demoPin.name,
  });

  return (
    <main
      style={brandCssVars(DEFAULT_BRAND) as React.CSSProperties}
      className="min-h-full bg-[#F6F5F2] px-6 py-10 text-black"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
            Spike · location &amp; directions
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            “That way, about this far.”
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-black/65">
            No routing API. A dotted line for bearing, a padded straight-line
            distance for effort, and Google Maps for the actual turns. The
            padding factor is{" "}
            <strong className="font-semibold">{AMSTERDAM_DETOUR_FACTOR}×</strong>{" "}
            because a straight line in this city crosses canals that have no
            bridge.
          </p>
        </header>

        {/* -------------------------------------------------- states ---- */}
        <Section
          title="1 · All four location states"
          blurb="Every arm of LocationState rendered as finished UI. None of them is an error screen; the two unhappy ones are one quiet line with at most one action."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {ALL_STATES.map((s) => (
              <div key={s.status} className="rounded-xl bg-white p-3 ring-1 ring-black/5">
                <p className="mb-2 font-mono text-[11px] text-black/40">
                  status: &quot;{s.status}&quot;
                </p>
                <LocationStatusStrip
                  state={s}
                  onRetry={
                    s.status === "denied" || s.status === "unavailable"
                      ? () => {}
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------------------------------------- live hook ----- */}
        <Section
          title="2 · useGuestLocation, live"
          blurb="The real hook, running with simulate: true so it reports FALLBACK_GUEST_POSITION (Dam Square). Flip simulate off and this becomes a real watchPosition."
        >
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
            <LocationStatusStrip state={location} onRetry={request} />
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/[0.04] p-3 font-mono text-[12px] leading-relaxed text-black/70">
{JSON.stringify({ location, reason, isSimulated }, null, 2)}
            </pre>
            <p className="mt-2 text-[12.5px] text-black/45">
              Brand primary resolved from{" "}
              <code className="font-mono">--brand-primary</code>:{" "}
              <span className="font-mono">{resolvedPrimary || "…"}</span> — the
              dotted line reads this, never a literal hex.
            </p>
          </div>
        </Section>

        {/* ------------------------------------------------ numbers ----- */}
        <Section
          title="3 · Real numbers from Dam Square"
          blurb="Guest at FALLBACK_GUEST_POSITION (4.8936, 52.3731). Crow-flies is the raw haversine; padded is × 1.4; the last column is what a guest actually reads."
        >
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-black/5">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-[11px] uppercase tracking-wider text-black/40">
                  <th className="px-4 py-2.5 font-semibold">Place</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Crow</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Padded</th>
                  <th className="px-4 py-2.5 font-semibold">Shown on the card</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((p) => (
                  <tr key={p.id} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <PinDot color={CATEGORY_MAP[p.category].color} />
                        {p.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-black/50">
                      {Math.round(haversineMeters(FALLBACK_GUEST_POSITION, p))} m
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-black/50">
                      {Math.round(walkingDistanceMeters(FALLBACK_GUEST_POSITION, p))} m
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[var(--brand-primary)]">
                      {formatWalk(FALLBACK_GUEST_POSITION, p)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2 rounded-xl bg-white p-4 text-sm ring-1 ring-black/5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-black/40">
              Edge cases
            </p>
            {[0, 20, 79, 85, 700, 975, 2100, 9400].map((m) => (
              <p key={m} className="flex gap-3 font-mono text-[12.5px]">
                <span className="w-20 shrink-0 text-right text-black/40">
                  {m} m
                </span>
                <span className="text-black/75">{formatWalkFromMeters(m)}</span>
              </p>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------ handoff ----- */}
        <Section
          title="4 · Google Maps hand-off"
          blurb="Documented, key-free Maps URL. Origin is omitted on purpose so Google uses the device's own live position — more accurate than anything we hold, and the guest's coordinates never end up in a URL."
        >
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
            <p className="text-sm text-black/60">
              Destination: <strong className="font-semibold">{demoPin.name}</strong>{" "}
              ({demoPin.lat}, {demoPin.lng})
            </p>
            <a
              href={demoUrl}
              {...DIRECTIONS_LINK_PROPS}
              className="mt-2 block break-all font-mono text-[12.5px] text-[var(--brand-primary)] underline underline-offset-2"
            >
              {demoUrl}
            </a>
            <p className="mt-3 text-[12.5px] leading-relaxed text-black/50">
              Coordinates rather than the place name: a name has to be geocoded
              and can resolve to the wrong branch or a similarly named spot in
              another city. The guide pinned an exact point, so we send that
              exact point. The name goes on the button instead —{" "}
              <span className="font-mono">
                {directionsButtonLabel(demoPin.name, { long: true })}
              </span>
              .
            </p>
          </div>
        </Section>

        {/* --------------------------------------------- dotted line ---- */}
        <Section
          title="5 · The dotted line"
          blurb="MapLibre line layer, line-dasharray [0, 2] with round caps, coloured from --brand-primary. Below is the same construction in SVG so the dash rhythm can be judged, and the reason it must not be solid."
        >
          <DottedLineMock />
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-black/55">
            The line above crosses the canal at a point with no bridge. The
            nearest crossing is off to the right. A solid line here would be a
            straightforward lie; dots say “roughly there, roughly this far”,
            which is all we actually know. Anyone who needs the real turns taps
            <em> Get directions</em>.
          </p>
          <div className="mt-6 rounded-xl bg-white p-4 ring-1 ring-black/5">
            <DashComparison />
          </div>
        </Section>

        {/* ------------------------------------------------- cards ------ */}
        <Section
          title="6 · The card, with and without location"
          blurb="The no-location card is the one that matters. It loses the distance row and the line, and keeps everything the guest actually came for: the place, the address, the guide's note, and the hand-off."
        >
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-black/40">
                granted
              </p>
              <PlaceCardMock pin={demoPin} guest={guest} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-black/40">
                denied / unavailable
              </p>
              <PlaceCardMock pin={demoPin} guest={null} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-black/40">
                granted · over {LONG_WALK_METERS} m
              </p>
              <PlaceCardMock pin={longWalkPin} guest={guest} />
            </div>
          </div>
          <p className="mt-5 max-w-2xl rounded-lg bg-amber-500/10 p-3 text-[13px] leading-relaxed text-black/70">
            <strong className="font-semibold">The worst case, on purpose.</strong>{" "}
            NDSM Werf is 3.1 km from Dam Square as the crow flies — and the crow
            flies straight over the IJ, which has no bridge, only a ferry. No
            detour factor can model that, so past{" "}
            {LONG_WALK_METERS} m the caveat changes to name the risk out loud
            rather than pretending 1.4× covers it.
          </p>
          <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-black/55">
            The prompt replaces the distance row rather than sitting above or
            below it, so the card keeps its height and never looks like
            something failed. It is a single quiet line, it appears once per
            card rather than once per screen, and it never blocks the hand-off
            button — a guest with location off can still get walking directions,
            because Google will use their device position even though we can’t.
          </p>
        </Section>
      </div>
    </main>
  );
}
