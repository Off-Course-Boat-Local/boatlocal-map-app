"use client";

// The phone itself — brand vars + PhoneFrame + the guest map.
//
// Extracted from PhonePreviewPanel so the same preview can be presented two
// ways without duplicating it: docked in a side panel (companies, who are
// actively editing brand colours and want continuous feedback) or inside a
// slide-over opened from the sidebar (guides, who don't control styling and
// only want to check their work now and then). See PhonePreviewPanel.tsx and
// PhonePreviewDrawer.tsx.
//
// Deliberately NOT the full guest screen (no filter pills, no place card, no
// geolocation) — its job is "does this look right", not "is this the guest
// app".

import { useState } from "react";

import BaseMap from "@/components/map/BaseMap";
import MapPins from "@/components/map/MapPins";
import PhoneFrame from "@/components/PhoneFrame";
import { brandCssVars } from "@/lib/brand";
import { AMSTERDAM_CENTER, type MapPin } from "@/lib/data";

import { useStudioPreview } from "./StudioPreviewContext";

export interface PhonePreviewProps {
  pins: MapPin[];
  /** e.g. "14 picks curated by Jan" or "14 picks across Boat & Bike Co." */
  subtitle: string;
}

export default function PhonePreview({ pins, subtitle }: PhonePreviewProps) {
  const { brand, logoUrl } = useStudioPreview();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    // Explicit `w-full` so PhoneFrame's own `w-full` has a concrete
    // percentage base to resolve against — the wrapper supplied by whichever
    // presentation is in use is the only fixed-width ancestor in the chain.
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
  );
}
