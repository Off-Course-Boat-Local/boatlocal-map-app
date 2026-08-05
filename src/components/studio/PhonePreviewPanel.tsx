"use client";

// The "live phone preview" PRD §7 asks for: reuses PhoneFrame and the same
// map primitives the guest app itself uses (BaseMap, MapPins) — deliberately
// NOT the full spike guest screen (no filter pills, no place card, no
// geolocation), because this panel's job is "does the brand look right",
// not "is this the guest app". It reads its brand from
// StudioPreviewContext, so it updates live the moment a future editor calls
// setBrand — see that module's header comment.
//
// Hidden below `xl` on purpose: a phone-shaped preview competes for width
// with the actual Studio content (forms, tables) on anything narrower, and
// Studio itself must stay usable on a laptop. Mobile-first applies to the
// guest app; this panel is a "nice to have on a wide enough screen" for the
// person editing it, which is realistically a desktop.

import { useState } from "react";

import BaseMap from "@/components/map/BaseMap";
import MapPins from "@/components/map/MapPins";
import PhoneFrame from "@/components/PhoneFrame";
import { brandCssVars } from "@/lib/brand";
import { AMSTERDAM_CENTER, type MapPin } from "@/lib/data";

import { useStudioPreview } from "./StudioPreviewContext";

export interface PhonePreviewPanelProps {
  pins: MapPin[];
  /** e.g. "14 picks curated by Jan" or "14 picks across Boat & Bike Co." */
  subtitle: string;
}

export default function PhonePreviewPanel({ pins, subtitle }: PhonePreviewPanelProps) {
  const { brand, logoUrl } = useStudioPreview();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <aside
      className="hidden shrink-0 flex-col gap-3 overflow-y-auto border-l border-neutral-200 bg-neutral-50 p-6 xl:flex xl:w-[460px]"
      aria-label="Live guest app preview"
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        Live preview
      </p>

      {/* Explicit `w-full` so PhoneFrame's own `w-full` has a concrete
          percentage base to resolve against — this <aside> is the only
          fixed-width ancestor in the chain. */}
      <div className="w-full" style={brandCssVars(brand)}>
        <PhoneFrame>
          <div className="flex h-full w-full flex-col">
            <header
              className="shrink-0 px-4 pb-3 pt-4 text-white"
              style={{ background: "var(--brand-primary)" }}
            >
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL / not-yet-hosted logo, same pattern as ShareQr/PlaceCard/PhotoGallery.
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full bg-white/90 object-contain p-0.5"
                  />
                ) : null}
                <p className="text-xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  {brand.appName}
                </p>
              </div>
              <p className="mt-1 text-xs opacity-80">{subtitle}</p>
            </header>

            <div className="relative min-h-0 flex-1">
              <BaseMap
                center={AMSTERDAM_CENTER}
                zoom={12.7}
                interactive={false}
                className="absolute inset-0"
              >
                <MapPins pins={pins} selectedId={selectedId} onSelect={setSelectedId} />
              </BaseMap>
            </div>
          </div>
        </PhoneFrame>
      </div>

      <p className="mx-auto max-w-[260px] text-center text-[11px] leading-relaxed text-neutral-500">
        Mirrors what a guest sees right now. Updates live as branding is edited.
      </p>
    </aside>
  );
}
