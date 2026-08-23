"use client";

// Forced first-time password setup, shown once to an admin who signed in
// via magic link and has never set a password (see
// src/app/admin/set-password/page.tsx and actions.ts). Same
// useActionState + admin theme-token pattern as AdminLoginForm.tsx.

import { useActionState } from "react";

import { setAdminPasswordAction, type SetAdminPasswordState } from "@/app/admin/set-password/actions";

const initialState: SetAdminPasswordState = {};

export default function SetAdminPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(setAdminPasswordAction, initialState);

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)]">
      <p className="text-xs font-semibold tracking-wide text-[var(--admin-ink-soft)] uppercase">
        Admin
      </p>
      <h1 className="mt-1 text-xl font-semibold text-[var(--admin-ink)]">Set your password</h1>
      <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">
        Signing in as <span className="font-medium text-[var(--admin-ink)]">{email}</span>. Choose
        a password so you can sign in without a link next time.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--admin-ink)]">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-[var(--admin-ink)]"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]"
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-[var(--admin-accent-strong)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Set password"}
        </button>
      </form>
    </div>
  );
}
