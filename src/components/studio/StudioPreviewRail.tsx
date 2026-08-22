"use client";

// The docked phone, now scoped to the ONE screen that earns it.
//
// It used to render on every Studio page as permanent chrome. That is what
// the founder pushed back on: a preview you can only look at doesn't need
// 460px of every screen, and the click-through preview it was standing in
// for is now its own page (/studio/preview, reached from the foot of the
// sidebar).
//
// Branding keeps it, because here it isn't a preview — it's live feedback on
// the control you are currently dragging. StudioPreviewContext updates the
// phone as colours, app name and logo change, before anything is saved; an
// iframe on another page cannot do that without a round trip per keystroke.
// So the two coexist deliberately: this answers "do my colours look right",
// /studio/preview answers "what do my guests actually get".

import { usePathname } from "next/navigation";

import PhonePreviewPanel from "./PhonePreviewPanel";
import type { MapPin } from "@/lib/data";

export interface StudioPreviewRailProps {
  pins: MapPin[];
  subtitle: string;
}

export default function StudioPreviewRail({ pins, subtitle }: StudioPreviewRailProps) {
  const pathname = usePathname();
  if (!pathname.startsWith("/studio/branding")) return null;

  return <PhonePreviewPanel pins={pins} subtitle={subtitle} />;
}
