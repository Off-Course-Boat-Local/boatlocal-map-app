"use client";

import { MoreIcon } from "@/components/PortalIcons";

/** Visual placeholder for the forthcoming per-user actions menu. */
export default function UserRowActions({ userName }: { userName: string }) {
  return (
    <button
      type="button"
      aria-label={`Actions for ${userName}`}
      title="User actions coming soon"
      className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--admin-ink-soft)] transition-colors hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)]"
    >
      <MoreIcon />
    </button>
  );
}
