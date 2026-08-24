// A single KPI tile with an optional period-over-period delta badge.
// Presentational only — see ./types.ts for the prop shape and
// src/lib/studio/dashboardAnalytics.ts for where today's real numbers come
// from. Nothing populates `delta` today (no period-over-period data source
// exists), so DeltaBadge currently never renders — it's kept because the
// prop shape still supports it for whenever that data exists.
//
// Styled as a Studio StatCard (see ../primitives.tsx) — bold Outfit numbers
// on a soft-shadow card — rather than a bespoke tile, so the Dashboard's
// KPIs read as the same "stat card" language as every other Studio page.

import { displayFontFamily } from "@/lib/fonts";
import { CARD_SHADOW, Eyebrow } from "../primitives";
import type { KpiItem } from "./types";

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
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
    <div
      className={`flex h-full flex-col rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          style={{ fontFamily: displayFontFamily }}
          className="text-[2rem] leading-none font-bold tracking-[-0.02em] text-[var(--studio-ink)] tabular-nums"
        >
          {item.value.toLocaleString()}
        </p>
        {item.delta !== undefined ? <DeltaBadge delta={item.delta} /> : null}
      </div>
      <Eyebrow className="mt-2.5 normal-case">{item.label}</Eyebrow>
      {item.delta !== undefined && item.deltaPeriodLabel ? (
        <p className="mt-1 text-[10px] text-[var(--studio-ink-soft)]">{item.deltaPeriodLabel}</p>
      ) : null}
    </div>
  );
}
