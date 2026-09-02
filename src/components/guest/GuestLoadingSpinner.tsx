// Centered loading spinner — the fallback Next.js shows automatically via
// a route segment's loading.tsx while that segment's Server Component data
// fetch is in flight (see e.g. src/app/(guest)/map/loading.tsx). Before
// this, navigating to a guest screen with no loading.tsx showed nothing at
// all until the new page's data resolved — a blank gap, not a loading
// state (founder report, 2026-09-02: "have a loading animation in the
// middle").
//
// Brand-coloured (var(--brand-primary)) rather than a neutral grey: this
// renders inside the (guest) layout, which has already resolved the
// tenant's brand CSS vars onto <main> by the time any child segment
// (loading.tsx included) paints — see src/app/(guest)/layout.tsx.

import { Loader2 } from "lucide-react";

export default function GuestLoadingSpinner() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <Loader2
        className="size-7 animate-spin"
        style={{ color: "var(--brand-primary)" }}
        strokeWidth={2.25}
        aria-hidden
      />
    </div>
  );
}
