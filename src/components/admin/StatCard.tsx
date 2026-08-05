export interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
}

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <p className="text-xs font-medium tracking-wide text-[var(--admin-ink-soft)] uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--admin-ink)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">{hint}</p> : null}
    </div>
  );
}
