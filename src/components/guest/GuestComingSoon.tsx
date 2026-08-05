// Shared placeholder for guest tabs not yet built (List, Saved, Review,
// Install today). Keeps the bottom nav fully navigable — every tab leads
// somewhere real, none of them 404 — while making unmistakably clear to
// both a tester and the next agent that the screen is a stub, not a bug.

import { displayFontFamily } from "@/lib/fonts";

export interface GuestComingSoonProps {
  title: string;
}

export default function GuestComingSoon({ title }: GuestComingSoonProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <h1
        className="text-2xl text-neutral-900"
        style={{ fontFamily: displayFontFamily }}
      >
        {title}
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
        This screen hasn&rsquo;t been built yet.
      </p>
    </div>
  );
}
