export interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
}

// Restyled after the reference design's StatCard
// (nice-notice/src/components/admin/primitives.tsx): a taller card, the
// label as a small tracked eyebrow, the value pushed to the bottom in a
// large Outfit numeral (via admin-theme.css's `.font-display` — see that
// file's own comment for why headings/stat numbers opt into Outfit while
// the rest of Admin stays Figtree), and a soft card shadow instead of a
// flat border-only box.
export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[var(--admin-shadow-card)] transition-shadow hover:shadow-[var(--admin-shadow-float)]">
      <div>
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--admin-ink-soft)] uppercase">
          {label}
        </p>
        <p className="font-display mt-2 text-[2.25rem] leading-none font-semibold tracking-tight text-[var(--admin-ink)]">
          {value}
        </p>
      </div>
      <div className="mt-2.5 min-h-[1rem]">
        {hint ? (
          <p className="text-xs text-[var(--admin-ink-soft)]">{hint}</p>
        ) : (
          <span className="invisible text-xs">&nbsp;</span>
        )}
      </div>
    </div>
  );
}
