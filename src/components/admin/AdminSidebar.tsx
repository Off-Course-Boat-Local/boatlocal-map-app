"use client";

// Admin's own nav chrome. Shares its visual design with Studio's sidebar
// (src/components/studio/StudioSidebar.tsx) — same wordmark, same nav-pill
// treatment, same icon style — per the founder's decision that Admin and
// Studio ("Partner Studio" in the original prototype) are one shared
// portal design, just different pages depending on role. Its palette
// (src/app/admin/admin-theme.css) stays a separate CSS-variable namespace
// from any tenant's guest brand colours, not because it looks different
// from Studio, but so a guest brand's own CSS custom properties can never
// leak in here.

import Link from "next/link";
import { usePathname } from "next/navigation";

import MapAppMark from "@/components/MapAppMark";
import {
  AnchorIcon,
  BuildingIcon,
  ChartIcon,
  GridIcon,
  LogoutIcon,
  StarIcon,
  UsersIcon,
} from "@/components/PortalIcons";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: GridIcon },
  { href: "/admin/boats", label: "Boats", icon: AnchorIcon },
  { href: "/admin/companies", label: "Companies", icon: BuildingIcon },
  { href: "/admin/guides", label: "Guides", icon: UsersIcon },
  { href: "/admin/analytics", label: "Platform analytics", icon: ChartIcon },
  // The platform-default company (src/lib/data/source.ts's
  // getPlatformDefaultCompany) — what a guest sees with no `?company=` at
  // all. A separate page from Companies because managing its content
  // (branding + recommendations) reuses Studio's own editors, not the
  // Companies table's row actions.
  { href: "/admin/default-company", label: "Default company", icon: StarIcon },
] as const;

export interface AdminSidebarProps {
  email: string;
  /** Server Action reference, passed down from the (protected) layout. */
  onLogoutAction: () => Promise<void>;
}

export default function AdminSidebar({ email, onLogoutAction }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)] px-4 py-6 text-[var(--admin-sidebar-ink)]">
      <div>
        <div className="px-2">
          <MapAppMark iconSize={24} className="text-[var(--admin-sidebar-ink)]" />
          <p className="mt-2 text-xs font-semibold tracking-widest text-[var(--admin-sidebar-ink-dim)] uppercase">
            Admin
          </p>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={active ? { background: "var(--admin-nav-active-bg)" } : undefined}
                className={[
                  "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "text-[var(--admin-sidebar-ink)]"
                    : "text-[var(--admin-sidebar-ink-dim)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-sidebar-ink)]",
                ].join(" ")}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[var(--admin-sidebar-border)] px-2 pt-4">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: "var(--admin-accent-strong)" }}
          >
            {email.charAt(0).toUpperCase()}
          </span>
          <p className="truncate text-xs text-[var(--admin-sidebar-ink-dim)]" title={email}>
            {email}
          </p>
        </div>
        <form action={onLogoutAction} className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-[var(--admin-sidebar-ink-dim)] transition-colors hover:bg-[var(--admin-bg)] hover:text-[var(--admin-sidebar-ink)]"
          >
            <LogoutIcon />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
