"use client";

// The "pick an existing company to flag as the platform default" control on
// /admin/default-company (src/app/admin/(protected)/default-company/page.tsx).
//
// FIRST-RUN UX JUDGMENT CALL: the task this page was built for offered two
// options — pick an existing company, or spin up a fresh one via
// createCompany() and flag it immediately. This picks the "pick existing"
// route on purpose: it's strictly more flexible (an admin can promote an
// already-configured tenant, or demote one back later — see
// CompanyRowActions.tsx's "Set as default"/"Unset as default" kebab items,
// which use this exact same action), and it avoids inventing a second
// company-creation form that would only duplicate CreateCompanyForm.tsx. An
// admin who genuinely wants a brand-new company for this can still use
// Companies -> Create company first, then come back here — that flow
// already exists and needs no new UI of its own.
//
// Reused for BOTH the true first-run empty state (no company flagged yet)
// and "switch which company holds the flag" (DefaultCompanyHeader.tsx) —
// same picker, different button label.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import PortalSelect from "@/components/PortalSelect";
import { setPlatformDefaultCompanyAction } from "@/lib/admin/defaultCompanyActions";
import type { CompanyRecord } from "@/lib/data/types";

import { PRIMARY_BUTTON_CLASS } from "./primitives";

export interface DefaultCompanyPickerProps {
  companies: CompanyRecord[];
  /** "Set as default" for the first-run empty state, "Switch" when replacing an existing default. */
  submitLabel?: string;
}

export default function DefaultCompanyPicker({
  companies,
  submitLabel = "Set as default",
}: DefaultCompanyPickerProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(companies[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="block text-sm font-medium text-[var(--admin-ink)]">
        Company
        <PortalSelect
          name="companyId"
          className="mt-1 min-w-[260px]"
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
          defaultValue={selectedId}
          onValueChange={setSelectedId}
        />
      </label>
      <button
        type="button"
        disabled={!selectedId || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setPlatformDefaultCompanyAction(selectedId);
            if (result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        className={PRIMARY_BUTTON_CLASS}
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
