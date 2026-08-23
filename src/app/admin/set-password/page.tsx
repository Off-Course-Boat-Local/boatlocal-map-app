import type { Metadata } from "next";
import { redirect } from "next/navigation";

import SetAdminPasswordForm from "@/components/admin/SetAdminPasswordForm";
import MapAppMark from "@/components/MapAppMark";
import { getAdminSession } from "@/lib/admin/devAuth";

export const metadata: Metadata = { title: "Set your password" };

// Outside the src/app/admin/(protected) route group on purpose: that
// group's layout calls requireAdminSession(), which redirects HERE whenever
// `passwordSet` is false — wrapping this same page in that layout would
// bounce it straight back to itself. So this page gates itself directly,
// with getAdminSession() (no redirect built in) instead:
//   - no session at all -> /admin/login, same as any other admin page.
//   - a session that already has a password -> /admin, nothing left to do
//     here (also guarded server-side in actions.ts, since this is only a
//     UX convenience — see devAuth.ts's own "not the only check" comment).
export default async function AdminSetPasswordPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  if (session.passwordSet) {
    redirect("/admin");
  }

  return (
    <div className="admin-root flex min-h-dvh items-center justify-center bg-[var(--admin-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-[var(--admin-ink)]">
          <MapAppMark iconSize={26} className="text-lg" />
        </div>

        <SetAdminPasswordForm email={session.email} />
      </div>
    </div>
  );
}
