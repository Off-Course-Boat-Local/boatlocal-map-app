// Guest activity per day — a dependency-free SVG line chart (server-rendered)
// with one line each for app opens, review clicks and BoatLocal booking
// clicks on a shared scale. Takes plain points so the page decides the range;
// zero days sit on the baseline (no dot), so "quiet" reads differently from
// "no data".

import type { DailyActivity } from "@/lib/data/source";

const W = 1100;
const H = 230;
const PAD = { top: 12, right: 8, bottom: 26, left: 28 };

const SERIES = [
  { key: "appOpens", label: "App opens", color: "var(--studio-accent, #1B5FE3)" },
  { key: "boatClicks", label: "BoatLocal clicks", color: "#E8590C" },
  { key: "reviewClicks", label: "Review clicks", color: "#2F9E44" },
] as const;

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export default function ActivityChart({ points }: { points: DailyActivity[] }) {
  const totals = SERIES.map((s) => points.reduce((sum, p) => sum + p[s.key], 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const max = niceMax(Math.max(0, ...points.flatMap((p) => SERIES.map((s) => p[s.key]))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(points.length, 1);
  const x = (i: number) => PAD.left + i * slot + slot / 2;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <section className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 shadow-[var(--studio-shadow-card)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-[var(--studio-ink)]">Guest activity per day</h2>
        <p className="text-xs text-[var(--studio-ink-soft)]">Last {points.length} days</p>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--studio-ink-soft)]">
        {SERIES.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full" style={{ background: s.color }} />
            {s.label} <span className="tabular-nums text-[var(--studio-ink)]">{totals[i]}</span>
          </li>
        ))}
      </ul>
      {grand === 0 ? (
        <p className="mt-4 text-sm text-[var(--studio-ink-soft)]">No activity recorded in this period yet.</p>
      ) : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Guest activity per day, last ${points.length} days: ${SERIES.map((s, i) => `${totals[i]} ${s.label.toLowerCase()}`).join(", ")}`}
        className="mx-auto mt-3 h-auto max-h-64 w-full"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(max * t)} y2={y(max * t)} stroke="var(--studio-border)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(max * t) + 3} textAnchor="end" fontSize="10" fill="var(--studio-ink-soft)">
              {Math.round(max * t)}
            </text>
          </g>
        ))}
        {SERIES.map((s) => {
          const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p[s.key]).toFixed(1)}`).join(" ");
          return (
            <g key={s.key}>
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) =>
                p[s.key] > 0 ? (
                  <circle key={p.date} cx={x(i)} cy={y(p[s.key])} r="4" fill="var(--studio-surface, #fff)" stroke={s.color} strokeWidth="2.5">
                    <title>{`${p.date}: ${p[s.key]} ${s.label.toLowerCase()}`}</title>
                  </circle>
                ) : null,
              )}
            </g>
          );
        })}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--studio-ink-soft)">
              {shortDate(p.date)}
            </text>
          ) : null,
        )}
      </svg>
    </section>
  );
}
