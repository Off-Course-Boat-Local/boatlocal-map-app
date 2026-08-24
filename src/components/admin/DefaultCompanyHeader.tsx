"use client";

// Header strip for the "a platform default IS configured" state of
// /admin/default-company: names the current default, and offers "Switch"
// (re-opens DefaultCompanyPicker inline, excluding the current holder from
// the options) or "Stop being the default" (unsetPlatformDefaultCompanyAction
// — see CompanyRowActions.tsx's own kebab item for the same action used
// per-row on the Companies table; this is the same toggle, just placed
// where an admin is already looking at this company's content).

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unsetPlatformDefaultCompanyAction } from "@/lib/admin/defaultCompanyActions";
import type { CompanyRecord } from "@/lib/data/types";

import { Eyebrow, GHOST_BUTTON_CLASS } from "./primitives";
import DefaultCompanyPicker from "./DefaultCompanyPicker";

export interface DefaultCompanyHeaderProps {
  company: CompanyRecord;
  /** Every other company, for the "Switch" picker — the current holder is excluded, since re-picking it would be a no-op. */
  otherCompanies: CompanyRecord[];
}

export default function DefaultCompanyHeader({ company, otherCompanies }: DefaultCompanyHeaderProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[var(--admin-shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow>Currently the default</Eyebrow>
          <p className="font-display mt-2 text-xl font-semibold tracking-tight text-[var(--admin-ink)]">
            {company.name}
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--admin-ink-soft)]">{company.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setSwitching((s) => !s)} className={GHOST_BUTTON_CLASS}>
            {switching ? "Cancel" : "Switch"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await unsetPlatformDefaultCompanyAction();
                if (result.error) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
            className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {isPending ? "Working…" : "Stop being the default"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {switching ? (
        otherCompanies.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--admin-ink-soft)]">
            There&rsquo;s no other company to switch to yet — onboard one first.
          </p>
        ) : (
          <DefaultCompanyPicker companies={otherCompanies} submitLabel="Switch to this company" />
        )
      ) : null}
    </div>
  );
}
