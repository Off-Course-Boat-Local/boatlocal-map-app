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

// Pill shape/sizing matches the reference design's StatusPill
// (nice-notice/src/components/admin/primitives.tsx) — rounded-full,
// smaller/tighter text, semibold — while keeping this app's own three-tone
// color mapping (positive/neutral/warning) exactly as callers already pass
// it in.
export default function StatusBadge({ status, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${TONE_CLASSES[tone]}`}
    >
      {status}
    </span>
  );
}
