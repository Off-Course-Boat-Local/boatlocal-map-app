"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import MapAppMark from "@/components/MapAppMark";
import { displayFontFamily, bodyFontFamily } from "@/lib/fonts";
import { requestPasswordResetAction } from "@/lib/auth/passwordActions";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const portal = (searchParams.get("portal") === "admin" ? "admin" : "studio") as "admin" | "studio";

  const [email, setEmail] = useState(initialEmail);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const loginUrl = portal === "admin" ? "/admin/login" : "/studio/login";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setError(null);
    startTransition(async () => {
      const res = await requestPasswordResetAction(email, portal);
      if (!res.ok && res.error) {
        setError(res.error);
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
          <CheckCircle2 className="size-6" />
        </div>
        <h1
          style={{ fontFamily: displayFontFamily }}
          className="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Check your email
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          We sent a password reset link to <strong className="font-semibold text-slate-900 dark:text-white">{email}</strong>.
          Click the link in the email to choose a new password.
        </p>
        <div className="pt-2">
          <Link
            href={loginUrl}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-[0.6875rem] font-semibold tracking-wider text-slate-400 uppercase">
          Account recovery
        </p>
        <h1
          style={{ fontFamily: displayFontFamily }}
          className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Reset password
        </h1>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Enter your email address and we&apos;ll send you a secure link to reset your password.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Email address
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoFocus
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Sending link…" : "Send reset link"}
      </button>

      <div className="pt-1 text-center">
        <Link
          href={loginUrl}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
      </div>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main
      style={{ fontFamily: bodyFontFamily }}
      className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950 p-6"
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-slate-900 dark:text-white">
          <MapAppMark iconSize={28} className="text-lg" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading...</div>}>
            <ForgotPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
