import type { ReactNode } from "react";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import { requireAdminSession } from "@/lib/admin/devAuth";

import { logout } from "./actions";

// Layer 2 of the three-layer auth model (see the comment on
// requireAdminSession in src/lib/admin/devAuth.ts): redirects a signed-out
// visitor to /admin/login and renders the sidebar shell for everyone else.
// This is a UX convenience for normal navigation, not the only line of
// defence — every Server Action under this tree still re-checks itself.
//
// Scoped to the (protected) route group only, so /admin/login (a sibling,
// outside this group) is never wrapped by this check — wrapping it would
// redirect the login page back to itself.
export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return (
    <div className="admin-root flex h-dvh w-full flex-col overflow-hidden bg-[var(--admin-bg)] text-[var(--admin-ink)] lg:flex-row">
      <AdminMobileNav email={session.email} onLogoutAction={logout} />
      <AdminSidebar email={session.email} onLogoutAction={logout} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
