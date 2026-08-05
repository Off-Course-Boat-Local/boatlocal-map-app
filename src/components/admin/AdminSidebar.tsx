"use client";

// Admin's own nav chrome. Deliberately not reusing any guest-facing
// component — Admin is Boat Local's internal tool, not a tenant surface,
// and its palette (src/app/admin/admin-theme.css) is separate on purpose.

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/boats", label: "Boats" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/guides", label: "Guides" },
  { href: "/admin/analytics", label: "Platform analytics" },
] as const;

export interface AdminSidebarProps {
  email: string;
  /** Server Action reference, passed down from the (protected) layout. */
  onLogoutAction: () => Promise<void>;
}

export default function AdminSidebar({ email, onLogoutAction }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between bg-[var(--admin-sidebar-bg)] px-4 py-6 text-[var(--admin-sidebar-ink)]">
      <div>
        <div className="px-2">
          <p className="text-xs font-semibold tracking-widest text-[var(--admin-sidebar-ink-dim)] uppercase">
            Boat Local
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--admin-sidebar-ink)]">Admin</p>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--admin-accent)] text-white"
                    : "text-[var(--admin-sidebar-ink-dim)] hover:bg-white/5 hover:text-[var(--admin-sidebar-ink)]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-2">
        <p className="truncate text-xs text-[var(--admin-sidebar-ink-dim)]" title={email}>
          {email}
        </p>
        <form action={onLogoutAction} className="mt-2">
          <button
            type="submit"
            className="text-xs font-medium text-[var(--admin-sidebar-ink-dim)] underline-offset-2 hover:text-[var(--admin-sidebar-ink)] hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
