"use client";

// The wiring slot for PRD §7's "real-time preview" requirement.
//
// PhonePreviewPanel always renders *something* real — the actual guest map,
// styled with the actual current brand — even before any branding editor
// exists. Once a Branding form is built, it calls `setBrand()` from its
// onChange handlers (a colour picker, a name field, …) and the preview
// panel updates live, because it is already reading `brand` from this
// context rather than from a prop baked in at page-load. Until that editor
// exists, nothing ever calls `setBrand`, so the preview is a correct-but-
// static mirror of the company's saved branding — the "stub/no-op" this
// task allows.
//
// Deliberately just a brand (plus, now, a logo URL), not a whole
// draft-company object: every other piece of the preview (which pins show,
// the guide's name) does not change while editing colours, so there is
// nothing to wire up for it yet. Extend this context's value shape, not its
// API, when the Guides/Recommendations editors need their own live-preview
// slot.
//
// logoUrl lives here rather than on Brand (src/lib/types.ts) on purpose:
// Brand is the lightweight guest-rendering shape every map component
// already depends on, and no guest component renders a logo today — adding
// a field nothing reads would just be dead weight on that type. It is
// company-scoped state for exactly one consumer (PhonePreviewPanel's
// header), which is what this context is for.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { Brand } from "@/lib/types";

interface StudioPreviewState {
  brand: Brand;
  setBrand: (brand: Brand) => void;
  /** Data URL or hosted URL of the company logo, or null if none is set. */
  logoUrl: string | null;
  setLogoUrl: (logoUrl: string | null) => void;
}

const StudioPreviewContext = createContext<StudioPreviewState | null>(null);

export function StudioPreviewProvider({
  initialBrand,
  initialLogoUrl = null,
  children,
}: {
  initialBrand: Brand;
  initialLogoUrl?: string | null;
  children: ReactNode;
}) {
  const [brand, setBrand] = useState<Brand>(initialBrand);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const value = useMemo(
    () => ({ brand, setBrand, logoUrl, setLogoUrl }),
    [brand, logoUrl],
  );

  return <StudioPreviewContext.Provider value={value}>{children}</StudioPreviewContext.Provider>;
}

/** Call from any future editor (Branding, …) to drive the live preview. No-op today: nothing calls setBrand, so the panel just shows the saved brand. */
export function useStudioPreview(): StudioPreviewState {
  const ctx = useContext(StudioPreviewContext);
  if (!ctx) {
    throw new Error("useStudioPreview must be used within a StudioPreviewProvider");
  }
  return ctx;
}
