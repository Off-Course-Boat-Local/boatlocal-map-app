import type { Metadata } from "next";

import MapAppMark from "@/components/MapAppMark";

import { sendAdminMagicLink } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

type ErrorCode = "not_authorized" | "send_failed" | "invalid_email";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  not_authorized: "This email isn't authorized for Admin access.",
  send_failed: "Couldn't send the sign-in link. Please try again in a moment.",
  invalid_email: "Enter a valid email address.",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; sent?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = firstParam(params.error);
  const errorMessage =
    errorCode && errorCode in ERROR_MESSAGES ? ERROR_MESSAGES[errorCode as ErrorCode] : null;
  const sent = firstParam(params.sent) === "1";

  return (
    <div className="admin-root flex min-h-dvh items-center justify-center bg-[var(--admin-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-[var(--admin-ink)]">
          <MapAppMark iconSize={26} className="text-lg" />
        </div>

        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-semibold tracking-wide text-[var(--admin-ink-soft)] uppercase">
            Admin
          </p>
          <h1 className="mt-1 text-xl font-semibold text-[var(--admin-ink)]">Staff sign in</h1>
          <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">
            Enter your Map App staff email and we&rsquo;ll send you a sign-in link. Admin access
            is invite-only — there is no self-serve sign-up.
          </p>

          {sent ? (
            <p
              role="status"
              className="mt-6 rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2 text-sm text-[var(--admin-ink)]"
            >
              Check your email for a sign-in link.
            </p>
          ) : (
            <form action={sendAdminMagicLink} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--admin-ink)]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  className="mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]"
                />
              </div>

              {errorMessage ? (
                <p role="alert" className="text-sm text-red-600">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-md bg-[var(--admin-accent-strong)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Send sign-in link
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
