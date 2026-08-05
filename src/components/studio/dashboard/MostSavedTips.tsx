// Most-saved tips (PRD §7.1), company view only. Ranked by save count —
// deliberately not a rating of any kind (see project rule: no star
// ratings/review counts anywhere). The colour dot uses the category
// palette from src/lib/categories.ts, which is intentionally separate from
// brand colour. `rows` is a plain prop (see ./types.ts); today it comes
// from src/lib/studio/mockAnalytics.ts's mockMostSavedTips, built off the
// real recommendation list with mock counts (no live analytics pipeline
// exists yet).

import { CATEGORY_MAP, categoryColor } from "@/lib/categories";

import type { MostSavedTipRow } from "./types";

export default function MostSavedTips({ rows }: { rows: MostSavedTipRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <p className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
        Most-saved tips
      </p>
      <ol className="divide-y divide-neutral-100">
        {rows.map((row, i) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              <span className="w-4 shrink-0 text-xs font-medium text-neutral-400">{i + 1}</span>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: categoryColor(row.category) }}
                aria-hidden
              />
              <span className="min-w-0 truncate text-neutral-900">{row.name}</span>
              <span className="shrink-0 text-xs text-neutral-400">
                {CATEGORY_MAP[row.category]?.label}
              </span>
            </span>
            <span className="shrink-0 text-neutral-600">{row.saveCount} saved</span>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-4 py-3 text-sm text-neutral-500">No recommendations yet.</li>
        ) : null}
      </ol>
    </div>
  );
}
