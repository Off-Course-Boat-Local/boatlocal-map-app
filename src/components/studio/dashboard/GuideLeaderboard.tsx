// Guide leaderboard (PRD §7.1), company view only. Ranked by tips saved —
// deliberately not a rating of any kind (see project rule: no star
// ratings/review counts anywhere). `rows` is a plain prop (see ./types.ts);
// today it comes from src/lib/studio/dashboardAnalytics.ts's
// guideTipsLeaderboard, a real sum over the company's events.

import type { LeaderboardRow } from "./types";

export default function GuideLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <p className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
        Guide leaderboard
      </p>
      <ol className="divide-y divide-neutral-100">
        {rows.map((row, i) => (
          <li key={row.guideId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-500">
                {i + 1}
              </span>
              <span className="min-w-0 truncate text-neutral-900">{row.name}</span>
            </span>
            <span className="shrink-0 text-neutral-600">{row.tipsSaved} saved</span>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-4 py-3 text-sm text-neutral-500">No guides yet.</li>
        ) : null}
      </ol>
    </div>
  );
}
