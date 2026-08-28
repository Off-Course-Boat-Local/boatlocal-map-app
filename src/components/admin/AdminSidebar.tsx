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
import { Compass } from "lucide-react";

import MapAppMark from "@/components/MapAppMark";
import {
  AnchorIcon,
  BuildingIcon,
  ChartIcon,
  GridIcon,
  LogoutIcon,
  PersonIcon,
  UsersIcon,
} from "@/components/PortalIcons";

function CompassNavIcon(props: { className?: string }) {
  return <Compass size={18} strokeWidth={1.75} {...props} />;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: GridIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/boats", label: "Boats", icon: AnchorIcon },
  { href: "/admin/companies", label: "Companies", icon: BuildingIcon },
  { href: "/admin/guides", label: "Guides", icon: PersonIcon },
  { href: "/admin/analytics", label: "Platform analytics", icon: ChartIcon },
  // The platform-default company (src/lib/data/source.ts's
  // getPlatformDefaultCompany) — what a guest sees with no `?company=` at
  // all. A separate page from Companies because managing its content
  // (branding + recommendations) reuses Studio's own editors, not the
  // Companies table's row actions.
  { href: "/admin/default-company", label: "Default settings", icon: CompassNavIcon },
] as const;

export interface AdminSidebarProps {
  email: string;
  /** Server Action reference, passed down from the (protected) layout. */
  onLogoutAction: () => Promise<void>;
}

export default function AdminSidebar({ email, onLogoutAction }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col justify-between gap-6 border-r border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)] p-5 text-[var(--admin-sidebar-ink)]">
      <div>
        <div className="px-1">
          <MapAppMark
            iconSize={26}
            className="font-display text-[var(--admin-sidebar-ink)]"
          />
          <p className="mt-4 text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--admin-sidebar-ink-dim)] uppercase">
            Admin
          </p>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "font-semibold text-[var(--admin-sidebar-ink)]"
                    : "text-[var(--admin-sidebar-ink-dim)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-sidebar-ink)]",
                ].join(" ")}
              >
                <Icon className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-[var(--admin-sidebar-border)] pt-4">
        <div className="flex items-center gap-2.5 px-1">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: "var(--admin-accent)" }}
          >
            {email.charAt(0).toUpperCase()}
          </span>
          <p className="truncate text-xs text-[var(--admin-sidebar-ink-dim)]" title={email}>
            {email}
          </p>
        </div>
        <form action={onLogoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[var(--admin-sidebar-ink-dim)] transition-colors hover:bg-[var(--admin-bg)] hover:text-[var(--admin-sidebar-ink)]"
          >
            <LogoutIcon />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
