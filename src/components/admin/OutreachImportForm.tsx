"use client";

// Outreach list page — the "Import CSV" dialog body. Same useActionState +
// Server Action pattern as every other outreach form (OutreachComposeForm,
// OutreachQuickActions), bound to importOutreachCsvAction
// (src/lib/admin/outreachActions.ts) instead of a per-prospect id.
//
// Deliberately does NOT reset/close on success the way CreateCompanyForm
// does: the result message here is a summary ("Imported 40, updated 24")
// the admin actually needs to read, not a per-row confirmation they'll see
// elsewhere. The file input DOES reset (via formRef.reset()) so a second
// upload doesn't silently resubmit the same file.

import { useActionState, useEffect, useRef } from "react";

import { FIELD_LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/admin/primitives";
import { importOutreachCsvAction, type OutreachActionResult } from "@/lib/admin/outreachActions";

const initialState: OutreachActionResult = {};

export default function OutreachImportForm() {
  const [state, formAction, pending] = useActionState(importOutreachCsvAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.message) return;
    formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <p className="text-xs text-[var(--admin-ink-soft)]">
        Same columns as scripts/data/amsterdam-tour-operators.csv. Matches existing prospects on
        Name — re-uploading a refreshed research file updates ratings/contact info without
        touching status or next-action progress already made.
      </p>

      <label className={`mt-4 block ${FIELD_LABEL_CLASS}`}>
        CSV file
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-1.5 block w-full text-sm text-[var(--admin-ink)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--admin-accent)] file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white file:transition-colors hover:file:bg-[var(--admin-accent-hover)]"
        />
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? "Importing…" : "Import"}
        </button>
        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
