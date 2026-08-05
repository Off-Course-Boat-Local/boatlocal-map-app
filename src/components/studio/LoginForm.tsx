"use client";

// DEV AUTH STAND-IN — this form only ever submits to loginAction
// (src/lib/studio/actions.ts). See src/lib/studio/devAuth.ts for the full
// explanation of what this becomes once real Supabase Auth exists.

import { useActionState } from "react";

import { loginAction, type LoginActionState } from "@/lib/studio/actions";
import { DEV_LOGIN_PASSWORD } from "@/lib/studio/session";

const initialState: LoginActionState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Studio</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Dev sign-in stand-in — any email works, password is{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-neutral-800">
            {DEV_LOGIN_PASSWORD}
          </code>
          .
        </p>
      </div>

      <label className="block text-sm font-medium text-neutral-700">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="jan@example.com"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
        />
      </label>

      <label className="block text-sm font-medium text-neutral-700">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
        />
      </label>

      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-medium text-neutral-700">Sign in as</legend>
        <label className="flex items-center gap-2 text-neutral-700">
          <input type="radio" name="role" value="company" defaultChecked />
          Company
        </label>
        <label className="flex items-center gap-2 text-neutral-700">
          <input type="radio" name="role" value="guide" />
          Guide
        </label>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
