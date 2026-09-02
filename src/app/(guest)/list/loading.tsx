// List screen skeleton — shown instantly on navigation (Next.js wraps
// list/page.tsx in a Suspense boundary with this as the fallback) while
// getMapPins() resolves. Shaped like the real screen (GuestScreenHeader's
// gradient band, filter pills, GuestPlaceRow-shaped cards) so the swap to
// real content reads as "it filled in," not "it changed" — founder report,
// 2026-09-02: wanted "scaffolding on the next page" instead of the blank
// gap that used to sit here.
//
// Real header TEXT isn't known yet (guide name / place count are the
// page's own data, not resolved at this point) — only the brand GRADIENT
// is, since (guest)/layout.tsx resolves brand CSS vars before rendering
// any child segment. So text becomes pulsing blocks; the gradient itself
// is the real one, not a placeholder.

import { BORDER, BRAND_GRADIENT } from "@/lib/guestTheme";

function Bar({ width, className = "" }: { width: string | number; className?: string }) {
  return (
    <span
      className={`animate-skeleton inline-block rounded-full bg-white/30 ${className}`}
      style={{ width, height: "0.75em" }}
      aria-hidden
    />
  );
}

function CardSkeleton() {
  return (
    <li className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
      <div className="animate-skeleton h-44 w-full bg-slate-200" aria-hidden />
      <div className="space-y-2.5 p-4">
        <div className="animate-skeleton h-4 w-3/4 rounded bg-slate-200" aria-hidden />
        <div className="animate-skeleton h-3 w-1/2 rounded bg-slate-200" aria-hidden />
        <div className="mt-3 flex items-center justify-between">
          <div className="animate-skeleton h-3 w-20 rounded bg-slate-200" aria-hidden />
          <div className="animate-skeleton h-9 w-24 rounded-full bg-slate-200" aria-hidden />
        </div>
      </div>
    </li>
  );
}

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex h-full w-full flex-col overflow-hidden">
      <header
        className="shrink-0 px-5 pb-6"
        style={{ background: BRAND_GRADIENT, paddingTop: "calc(env(safe-area-inset-top) + 1.75rem)" }}
      >
        <Bar width="30%" className="mb-3" />
        <span
          className="animate-skeleton block rounded-full bg-white/30"
          style={{ width: "60%", height: "1.75rem" }}
          aria-hidden
        />
      </header>

      <div className="-mt-3 min-h-0 flex-1 overflow-hidden rounded-t-2xl bg-white">
        <div className="flex gap-2 overflow-hidden px-5 pt-5">
          {[72, 88, 96, 80].map((w, i) => (
            <span
              key={i}
              className="animate-skeleton h-9 shrink-0 rounded-full bg-slate-200"
              style={{ width: w }}
              aria-hidden
            />
          ))}
        </div>

        <ul className="space-y-4 px-5 py-5" style={{ margin: 0 }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </ul>
      </div>
    </div>
  );
}
