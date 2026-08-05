// Guest-activity chart (PRD §7.1), company view only.
//
// Deliberately a plain CSS bar chart, not a charting library — the shape is
// simple (one series, small n) and this keeps the bundle and the review
// surface small. Bars read their colour from `var(--brand-primary)`, which
// is only defined by an ancestor's inline style (see
// src/components/studio/StudioBrandScope.tsx) — this component must always
// render inside that scope, exactly like PhonePreviewPanel's brand usage.
//
// `data` is a plain prop (see ./types.ts) — today it comes from
// src/lib/studio/mockAnalytics.ts's mockGuestActivity (no live analytics
// pipeline exists yet).

import type { GuestActivityPoint } from "./types";

export default function GuestActivityChart({
  data,
  title = "Guest activity",
}: {
  data: GuestActivityPoint[];
  title?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500">{total.toLocaleString()} total</p>
      </div>

      <div
        className="mt-4 flex items-end gap-1.5"
        style={{ height: 120 }}
        role="img"
        aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
      >
        {data.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(4, Math.round((d.value / max) * 100))}%`,
                background: "var(--brand-primary)",
              }}
              title={`${d.label}: ${d.value}`}
            />
            <span className="text-[10px] text-neutral-400">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
