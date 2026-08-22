"use client";

// The Studio sidebar. One component, fed a role-filtered nav list — Studio
// is one app for both roles (see src/lib/studio/nav.ts), not two separate
// sidebars. Shares its visual design with Admin's sidebar
// (src/components/admin/AdminSidebar.tsx) — same wordmark, same nav-pill
// treatment, same icon style — per the founder's decision that Admin and
// Studio ("Partner Studio" in the original prototype) are one shared
// portal design, just different pages depending on role.

import Link from "next/link";
import { usePathname } from "next/navigation";

import MapAppMark, { PORTAL_NAV_ACTIVE_BG } from "@/components/MapAppMark";
import {
  AnchorIcon,
  GearIcon,
  GridIcon,
  LinkIcon,
  LogoutIcon,
  MegaphoneIcon,
  PaletteIcon,
  PersonIcon,
  PhoneIcon,
  PinListIcon,
  ReportIcon,
  UsersIcon,
} from "@/components/PortalIcons";
import { logoutAction } from "@/lib/studio/actions";
import type { StudioNavItem } from "@/lib/studio/nav";

const PREVIEW_HREF = "/studio/preview";

const NAV_ICONS: Record<string, typeof GridIcon> = {
  dashboard: GridIcon,
  branding: PaletteIcon,
  guides: UsersIcon,
  recommendations: PinListIcon,
  "boat-tours": AnchorIcon,
  campaign: MegaphoneIcon,
  report: ReportIcon,
  "link-qr": LinkIcon,
  profile: PersonIcon,
  settings: GearIcon,
};

export interface StudioSidebarProps {
  items: StudioNavItem[];
  /** "Company" or "Guide" — shown under the name so it's always obvious which shell you're looking at. */
  roleLabel: string;
  /** Company name, or the guide's own name for a guide session. */
  name: string;
}

export default function StudioSidebar({ items, roleLabel, name }: StudioSidebarProps) {
  const pathname = usePathname();
  const previewActive = pathname.startsWith(PREVIEW_HREF);

  return (
    <nav
      className="flex w-60 shrink-0 flex-col justify-between border-r border-neutral-200 bg-white p-4"
      aria-label="Studio navigation"
    >
      <div>
        <div className="px-2">
          <MapAppMark iconSize={24} className="text-neutral-900" />
        </div>

        <div className="mt-6 mb-6 px-2">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          <p className="text-xs text-neutral-500">{roleLabel}</p>
        </div>

        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              item.href === "/studio" ? pathname === "/studio" : pathname.startsWith(item.href);
            const Icon = NAV_ICONS[item.key] ?? GridIcon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  style={active ? { background: PORTAL_NAV_ACTIVE_BG } : undefined}
                  className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
                    active ? "text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                >
                  <Icon />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Foot of the sidebar. Preview sits here with Log out rather than in
          the nav list above, because it isn't another part of Studio to
          manage — it's a way of stepping outside Studio to look at the guest
          app. Same reason it's a link to a real page now instead of the
          docked panel/drawer it used to be: previewing is something you go
          and do, not something that occupies width on every screen. */}
      <div className="space-y-1">
        <Link
          href={PREVIEW_HREF}
          aria-current={previewActive ? "page" : undefined}
          style={previewActive ? { background: PORTAL_NAV_ACTIVE_BG } : undefined}
          className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
            previewActive
              ? "text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          <PhoneIcon />
          Preview
        </Link>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <LogoutIcon />
            Log out
          </button>
        </form>
      </div>
    </nav>
  );
}
