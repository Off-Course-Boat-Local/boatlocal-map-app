// Guide leaderboard (PRD §7.1), company view only. Ranked by tips saved —
// deliberately not a rating of any kind (see project rule: no star
// ratings/review counts anywhere). `rows` is a plain prop (see ./types.ts);
// today it comes from src/lib/studio/dashboardAnalytics.ts's
// guideTipsLeaderboard, a real sum over the company's events.

import { displayFontFamily } from "@/lib/fonts";
import { CARD_SHADOW } from "../primitives";
import type { LeaderboardRow } from "./types";

export default function GuideLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ${CARD_SHADOW}`}
    >
      <p
        style={{ fontFamily: displayFontFamily }}
        className="border-b border-[var(--studio-border)] px-5 py-3.5 text-sm font-semibold tracking-[-0.01em] text-[var(--studio-ink)]"
      >
        Guide leaderboard
      </p>
      <ol className="divide-y divide-[var(--studio-border)]">
        {rows.map((row, i) => (
          <li key={row.guideId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--studio-bg)] text-xs font-semibold text-[var(--studio-ink-soft)]">
                {i + 1}
              </span>
              <span className="min-w-0 truncate font-medium text-[var(--studio-ink)]">{row.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-[var(--studio-ink-soft)]">
              {row.tipsSaved} saved
            </span>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-5 py-4 text-sm text-[var(--studio-ink-soft)]">No guides yet.</li>
        ) : null}
      </ol>
    </div>
  );
}
