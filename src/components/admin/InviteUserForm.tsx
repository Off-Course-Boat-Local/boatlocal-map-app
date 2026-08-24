"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import {
  checkUserEmailAction,
  inviteUserAction,
  type EmailAvailabilityState,
  type InviteUserActionState,
} from "@/lib/admin/userActions";
import {
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "./primitives";

const initialState: InviteUserActionState = {};

export interface InviteUserCompanyOption {
  id: string;
  name: string;
}

export default function InviteUserForm({
  companies,
  onDone,
}: {
  companies: InviteUserCompanyOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(inviteUserAction, initialState);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [availability, setAvailability] = useState<EmailAvailabilityState | null>(null);
  const [checking, startEmailCheck] = useTransition();
  const [copied, setCopied] = useState(false);

  if (state.success) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            {state.emailSent ? "Invitation sent" : "Invitation created"}
          </p>
          <p className="mt-1 text-sm text-emerald-800/80">
            {state.emailSent
              ? `We sent an account setup link to ${state.email}.`
              : `The account setup link for ${state.email} is ready, but the email could not be sent.`}
          </p>
        </div>

        {!state.emailSent && state.emailError ? (
          <p role="alert" className="text-sm text-amber-700">
            {state.emailError}
          </p>
        ) : null}

        {state.inviteUrl ? (
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)]/60 p-3">
            <p className="text-xs font-medium text-[var(--admin-ink-soft)]">Invite link</p>
            <p className="mt-1 break-all font-mono text-xs text-[var(--admin-ink)]">
              {state.inviteUrl}
            </p>
            <button
              type="button"
              className={`${GHOST_BUTTON_CLASS} mt-3 py-2`}
              onClick={() => {
                navigator.clipboard.writeText(state.inviteUrl ?? "").then(() => setCopied(true));
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              router.refresh();
              onDone();
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const needsCompany = role === "company" || role === "guide";

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm leading-6 text-[var(--admin-ink-soft)]">
        Send a secure account-setup link. The recipient will confirm their name and choose a
        password before their account becomes active.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={FIELD_LABEL_CLASS}>
          First name <span className="font-normal text-[var(--admin-ink-soft)]">(optional)</span>
          <input
            name="firstName"
            type="text"
            maxLength={80}
            autoComplete="off"
            placeholder="Maria"
            className={`${FIELD_CLASS} mt-1.5`}
          />
        </label>
        <label className={FIELD_LABEL_CLASS}>
          Last name <span className="font-normal text-[var(--admin-ink-soft)]">(optional)</span>
          <input
            name="lastName"
            type="text"
            maxLength={80}
            autoComplete="off"
            placeholder="de Vries"
            className={`${FIELD_CLASS} mt-1.5`}
          />
        </label>
      </div>

      <label className={FIELD_LABEL_CLASS}>
        Email address
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setAvailability(null);
          }}
          onBlur={() => {
            if (!email.trim()) return;
            startEmailCheck(async () => setAvailability(await checkUserEmailAction(email)));
          }}
          placeholder="maria@example.com"
          className={`${FIELD_CLASS} mt-1.5`}
          aria-describedby="invite-email-status"
        />
        <span id="invite-email-status" className="mt-1.5 block min-h-5 text-xs" aria-live="polite">
          {checking ? <span className="text-[var(--admin-ink-soft)]">Checking email…</span> : null}
          {!checking && availability?.available ? (
            <span className="font-medium text-emerald-700">Email is available.</span>
          ) : null}
          {!checking && availability?.error ? (
            <span className="font-medium text-red-600">{availability.error}</span>
          ) : null}
        </span>
      </label>

      <label className={FIELD_LABEL_CLASS}>
        User role
        <select
          name="role"
          required
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className={`${FIELD_CLASS} mt-1.5`}
        >
          <option value="" disabled>
            Select a role
          </option>
          <option value="guide">Guide</option>
          <option value="company">Company admin</option>
          <option value="admin">Staff</option>
        </select>
      </label>

      {needsCompany ? (
        <label className={FIELD_LABEL_CLASS}>
          Company
          <select name="companyId" required className={`${FIELD_CLASS} mt-1.5`} defaultValue="">
            <option value="" disabled>
              Select a company
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3.5 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] pt-4">
        <button type="button" onClick={onDone} disabled={pending} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || checking || availability?.available === false}
          className={PRIMARY_BUTTON_CLASS}
        >
          {pending ? "Sending invitation…" : "Send invitation"}
        </button>
      </div>
    </form>
  );
}
