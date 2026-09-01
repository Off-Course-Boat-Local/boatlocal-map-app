"use client";

// High-fidelity phone preview for Partner Studio (docked on Branding & drawer).
// Mirrors the real-life guest map app with brand header, interactive category
// filter pills, live map pins, selected place preview card, and the authentic
// 4-tab bottom navigation bar, updating live as brand settings change.

import { useState } from "react";
import { Heart, LayoutList, Map as MapIcon, MessageSquareHeart } from "lucide-react";

import BaseMap from "@/components/map/BaseMap";
import MapPins from "@/components/map/MapPins";
import PhoneFrame from "@/components/PhoneFrame";
import { FilterPills } from "@/components/map/FilterPills";
import { brandCssVars } from "@/lib/brand";
import { AMSTERDAM_CENTER, type MapPin } from "@/lib/data";
import type { CategoryId } from "@/lib/types";
import { useStudioPreview } from "./StudioPreviewContext";

export interface PhonePreviewProps {
  pins: MapPin[];
  /** e.g. "14 picks across Boat & Bike Co." */
  subtitle: string;
}

export default function PhonePreview({ pins, subtitle }: PhonePreviewProps) {
  const { brand, logoUrl } = useStudioPreview();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "list" | "saved" | "review">("map");

  const filteredPins = categoryFilter
    ? pins.filter((p) =>
        p.isBoat ? categoryFilter === "boats" : p.categories.includes(categoryFilter),
      )
    : pins;

  const selectedPin = pins.find((p) => p.id === selectedId);

  return (
    <div className="w-full select-none" style={brandCssVars(brand)}>
      <PhoneFrame>
        <div className="flex h-full w-full flex-col bg-white overflow-hidden text-slate-900">
          {/* Authentic Guest Brand Header */}
          <header
            className="shrink-0 px-4 pb-3 pt-3.5 text-white shadow-xs transition-colors duration-200"
            style={{ background: "var(--brand-primary)" }}
          >
            <div className="flex items-center gap-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="size-7 shrink-0 rounded-full bg-white/95 object-contain p-0.5 shadow-2xs"
                />
              ) : null}
              <p className="truncate text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {brand.appName || "Map App"}
              </p>
            </div>
            <p className="mt-0.5 truncate text-[11px] opacity-85 font-medium">{subtitle}</p>
          </header>

          {/* Category Filter Pills Bar */}
          <div className="shrink-0 border-b border-slate-100 bg-white/95 px-3 py-1.5 backdrop-blur-xs">
            <FilterPills
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
          </div>

          {/* Interactive Map Area */}
          <div className="relative min-h-0 flex-1">
            <BaseMap
              center={AMSTERDAM_CENTER}
              zoom={12.8}
              interactive={true}
              className="absolute inset-0"
            >
              <MapPins
                pins={filteredPins}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
              />
            </BaseMap>

            {/* Selected Pin Quick Preview Card */}
            {selectedPin && (
              <div className="absolute bottom-3 left-3 right-3 z-10 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="rounded-2xl border border-slate-200/80 bg-white/98 p-3 shadow-lg backdrop-blur-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {selectedPin.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500 mt-0.5">
                        {selectedPin.area} {selectedPin.meta ? `· ${selectedPin.meta}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-xl py-1.5 text-center text-[11px] font-bold text-white shadow-xs"
                      style={{ background: "var(--brand-primary)" }}
                    >
                      {selectedPin.isBoat ? "Book this tour" : "Directions"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Authentic Guest 4-Tab Bottom Navigation Bar */}
          <nav
            aria-label="Guest navigation tabs preview"
            className="shrink-0 border-t border-slate-200/80 bg-white/95 px-2 py-1.5 backdrop-blur-md"
          >
            <div className="grid grid-cols-4 items-center">
              {/* Map Tab */}
              <button
                type="button"
                onClick={() => setActiveTab("map")}
                className="flex flex-col items-center justify-center gap-0.5 py-1 text-center transition-colors"
                style={{
                  color: activeTab === "map" ? "var(--brand-primary)" : "#657386",
                }}
              >
                <div
                  className="flex h-7 w-11 items-center justify-center rounded-full transition-colors"
                  style={{
                    backgroundColor: activeTab === "map" ? "color-mix(in srgb, var(--brand-primary) 12%, transparent)" : "transparent",
                  }}
                >
                  <MapIcon className="size-4" strokeWidth={2.25} />
                </div>
                <span className="text-[10px] font-semibold">Map</span>
              </button>

              {/* List Tab */}
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="flex flex-col items-center justify-center gap-0.5 py-1 text-center transition-colors"
                style={{
                  color: activeTab === "list" ? "var(--brand-primary)" : "#657386",
                }}
              >
                <div
                  className="flex h-7 w-11 items-center justify-center rounded-full transition-colors"
                  style={{
                    backgroundColor: activeTab === "list" ? "color-mix(in srgb, var(--brand-primary) 12%, transparent)" : "transparent",
                  }}
                >
                  <LayoutList className="size-4" strokeWidth={2.25} />
                </div>
                <span className="text-[10px] font-semibold">List</span>
              </button>

              {/* Saved Tab */}
              <button
                type="button"
                onClick={() => setActiveTab("saved")}
                className="flex flex-col items-center justify-center gap-0.5 py-1 text-center transition-colors"
                style={{
                  color: activeTab === "saved" ? "var(--brand-primary)" : "#657386",
                }}
              >
                <div
                  className="flex h-7 w-11 items-center justify-center rounded-full transition-colors"
                  style={{
                    backgroundColor: activeTab === "saved" ? "color-mix(in srgb, var(--brand-primary) 12%, transparent)" : "transparent",
                  }}
                >
                  <Heart className="size-4" strokeWidth={2.25} />
                </div>
                <span className="text-[10px] font-semibold">Saved</span>
              </button>

              {/* Review Tab */}
              <button
                type="button"
                onClick={() => setActiveTab("review")}
                className="flex flex-col items-center justify-center gap-0.5 py-1 text-center transition-colors"
                style={{
                  color: activeTab === "review" ? "var(--brand-primary)" : "#657386",
                }}
              >
                <div
                  className="flex h-7 w-11 items-center justify-center rounded-full transition-colors"
                  style={{
                    backgroundColor: activeTab === "review" ? "color-mix(in srgb, var(--brand-primary) 12%, transparent)" : "transparent",
                  }}
                >
                  <MessageSquareHeart className="size-4" strokeWidth={2.25} />
                </div>
                <span className="text-[10px] font-semibold">Review</span>
              </button>
            </div>
          </nav>
        </div>
      </PhoneFrame>
    </div>
  );
}
