// A single KPI tile with an optional period-over-period delta badge.
// Presentational only — see ./types.ts for the prop shape and
// src/lib/studio/mockAnalytics.ts for where today's (mock) numbers come
// from.

import type { KpiItem } from "./types";

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
        positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      <span aria-hidden>{positive ? "▲" : "▼"}</span>
      {Math.abs(delta)}%
    </span>
  );
}

export default function KpiCard({ item }: { item: KpiItem }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-semibold text-neutral-900">{item.value.toLocaleString()}</p>
        {item.delta !== undefined ? <DeltaBadge delta={item.delta} /> : null}
      </div>
      <p className="mt-1 text-xs text-neutral-500">{item.label}</p>
      {item.delta !== undefined && item.deltaPeriodLabel ? (
        <p className="mt-0.5 text-[10px] text-neutral-400">{item.deltaPeriodLabel}</p>
      ) : null}
    </div>
  );
}
