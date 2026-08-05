"use client";

// Admin Companies — onboarding form (PRD §8.3: "create/onboard a company
// (assign subdomain — §13.1)"). Submits to createCompanyAction
// (src/lib/admin/companyActions.ts), which creates the row via
// createCompany (src/lib/data/source.ts) and revalidates the page — same
// useActionState + form-reset-on-success pattern as Studio's
// InviteGuideForm (src/components/studio/InviteGuideForm.tsx).
//
// Subdomain is optional: leaving it blank falls back to a slug of the
// company name (see createCompany's slugify() call) — the field exists so
// an admin can override that default, not because it's required input.

import { useActionState, useEffect, useRef } from "react";

import { createCompanyAction, type CreateCompanyActionState } from "@/lib/admin/companyActions";
import type { CompanyStatus, CompanyType } from "@/lib/data/types";

const initialState: CreateCompanyActionState = {};

const COMPANY_TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: "hotel", label: "Hotel" },
  { value: "tour", label: "Tour operator" },
  { value: "host", label: "Host" },
];

// "active" is what PRD prose calls "live" — see the CompanyStatus comment
// in src/lib/data/types.ts for why there's no separate DB value for it.
// "suspended" is left out of onboarding on purpose: a company doesn't get
// suspended at creation time, only afterwards (via the table's row action).
const INITIAL_STATUS_OPTIONS: { value: CompanyStatus; label: string; hint: string }[] = [
  { value: "setup", label: "Setup", hint: "Not shown to guests yet — still being configured." },
  { value: "active", label: "Live", hint: "Immediately guest-visible at its subdomain." },
];

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]";
const labelClass = "block text-sm font-medium text-[var(--admin-ink)]";

export default function CreateCompanyForm() {
  const [state, formAction, pending] = useActionState(createCompanyAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // `state` is a fresh object on every dispatch (including repeated
  // successes), so this fires after each successful submit, not just the
  // first — clearing the form for the next company.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
    >
      <p className="text-sm font-medium text-[var(--admin-ink)]">Onboard a new company</p>
      <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">
        Starts with a neutral placeholder brand — the company customises colours and logo later in
        Studio &gt; Branding.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          Company name
          <input name="name" required placeholder="Hotel V Nesplein" className={inputClass} />
        </label>

        <label className={labelClass}>
          Subdomain
          <input
            name="subdomain"
            placeholder="auto from name"
            spellCheck={false}
            className={`${inputClass} font-mono`}
          />
        </label>

        <label className={labelClass}>
          Type
          <select name="companyType" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose one
            </option>
            {COMPANY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Initial status
          <select name="status" defaultValue="setup" className={inputClass}>
            {INITIAL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
        {state.success ? (
          <p role="status" className="text-sm text-emerald-700">
            Company created — find it in the list below.
          </p>
        ) : null}
      </div>
    </form>
  );
}
