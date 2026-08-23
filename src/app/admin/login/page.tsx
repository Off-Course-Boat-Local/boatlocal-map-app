import type { Metadata } from "next";

import AdminLoginForm from "@/components/admin/AdminLoginForm";
import MapAppMark from "@/components/MapAppMark";

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
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = firstParam(params.error);
  const errorMessage =
    errorCode && errorCode in ERROR_MESSAGES ? ERROR_MESSAGES[errorCode as ErrorCode] : undefined;

  return (
    <div className="admin-root flex min-h-dvh items-center justify-center bg-[var(--admin-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-[var(--admin-ink)]">
          <MapAppMark iconSize={26} className="text-lg" />
        </div>

        <AdminLoginForm initialError={errorMessage} />
      </div>
    </div>
  );
}
