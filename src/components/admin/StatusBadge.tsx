export type StatusTone = "positive" | "neutral" | "warning";

const TONE_CLASSES: Record<StatusTone, string> = {
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  neutral: "bg-[var(--admin-border)] text-[var(--admin-ink-soft)]",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export interface StatusBadgeProps {
  status: string;
  tone?: StatusTone;
}

export default function StatusBadge({ status, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {status}
    </span>
  );
}
