"use client";

// Admin Companies — onboarding form (PRD §8.3: "create/onboard a company").
// Submits to createCompanyAction (src/lib/admin/companyActions.ts), which
// creates the row via createCompany (src/lib/data/source.ts) and
// revalidates the page — same useActionState + form-reset-on-success
// pattern as Studio's InviteGuideForm (src/components/studio/InviteGuideForm.tsx).
//
// No identifier field here: a company's `id` (the primary key) is assigned
// by the database default on insert — there is nothing for an admin to type
// or override.

import { useActionState, useEffect, useRef } from "react";

import { createCompanyAction, type CreateCompanyActionState } from "@/lib/admin/companyActions";

const initialState: CreateCompanyActionState = {};

export interface CreateCompanyFormProps {
  /**
   * Called once the company is created AND its invite sent cleanly. Not
   * called when `inviteWarning` is set — the operator still needs to read
   * that warning and copy the invite link, and re-submitting the form at
   * that point would only create a second, duplicate company (the first
   * already exists). Used by CreateCompanyButton.tsx to close the dialog
   * it's rendered inside; the standalone (non-dialog) render passes nothing.
   */
  onDone?: () => void;
}

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]";
const labelClass = "block text-sm font-medium text-[var(--admin-ink)]";

export default function CreateCompanyForm({ onDone }: CreateCompanyFormProps) {
  const [state, formAction, pending] = useActionState(createCompanyAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // `state` is a fresh object on every dispatch (including repeated
  // successes), so this fires after each successful submit, not just the
  // first — clearing the form for the next company.
  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    // NOT called when inviteWarning is set — see this prop's own doc
    // comment for why: the operator still needs to read the warning and
    // copy the invite link before a dialog caller would close this away.
    if (!state.inviteWarning) onDone?.();
  }, [state, onDone]);

  return (
    <form ref={formRef} action={formAction}>
      {/* No card chrome and no "Onboard a new company" heading here — this
          only ever renders inside CreateCompanyButton.tsx's PortalModal now,
          which already supplies both (the dialog card, and its title). */}
      <p className="text-xs text-[var(--admin-ink-soft)]">
        Starts with a neutral placeholder brand — the company customises colours and logo later in
        Studio &gt; Branding. The owner&rsquo;s email is who signs in to manage this company — not a
        general contact address; they&rsquo;ll get an invite link to set their password. Every
        company starts hidden from guests until its owner publishes it themselves from Studio.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Company name
          <input name="name" required placeholder="Hotel V Nesplein" className={inputClass} />
        </label>

        <label className={labelClass}>
          Owner&rsquo;s email
          <input
            name="ownerEmail"
            type="email"
            required
            placeholder="owner@hotelv.com"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Type <span className="font-normal text-[var(--admin-ink-soft)]">(optional)</span>
          <input
            name="companyType"
            placeholder="Hotel, Shop, Bar…"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--admin-accent-strong)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create company"}
        </button>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}
        {/* The company was created either way — an invite that didn't send
            is a warning, never an error, since re-submitting this form
            would now create a duplicate company. See
            CreateCompanyActionState.inviteWarning. */}
        {state.success && !state.inviteWarning ? (
          <p role="status" className="text-sm text-emerald-700">
            Company created — invite sent to the owner.
          </p>
        ) : null}
      </div>

      {state.success && state.inviteWarning ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {state.inviteWarning}
        </p>
      ) : null}
    </form>
  );
}
