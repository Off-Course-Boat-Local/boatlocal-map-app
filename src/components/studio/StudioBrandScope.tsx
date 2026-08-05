"use client";

// A thin CSS-custom-property scope for Studio content that needs the
// current brand colour without hard-coding it (e.g. the Dashboard's guest-
// activity chart bars). Reuses the same StudioPreviewContext the live phone
// preview already reads from (see PhonePreviewPanel.tsx / that context's
// header comment) so there is exactly one source of "what is the current
// brand" in Studio, not two.
//
// Wrapping a subtree in this Client Component does not make that subtree
// client-rendered: React lets a Server Component be passed straight through
// as `children`, and CSS custom properties set on this wrapper's own <div>
// inherit down through the DOM to whatever gets rendered inside it,
// regardless of the server/client boundary. Children just read
// `var(--brand-primary)` etc. in an inline style, same as PhonePreviewPanel
// does today.

import type { ReactNode } from "react";

import { brandCssVars } from "@/lib/brand";

import { useStudioPreview } from "./StudioPreviewContext";

export default function StudioBrandScope({ children }: { children: ReactNode }) {
  const { brand } = useStudioPreview();
  return <div style={brandCssVars(brand)}>{children}</div>;
}
