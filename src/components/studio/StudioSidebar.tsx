"use client";

// The Studio sidebar. One component, fed a role-filtered nav list — Studio
// is one app for both roles (see src/lib/studio/nav.ts), not two separate
// sidebars.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/lib/studio/actions";
import type { StudioNavItem } from "@/lib/studio/nav";

export interface StudioSidebarProps {
  items: StudioNavItem[];
  /** "Company" or "Guide" — shown under the name so it's always obvious which shell you're looking at. */
  roleLabel: string;
  /** Company name, or the guide's own name for a guide session. */
  name: string;
}

export default function StudioSidebar({ items, roleLabel, name }: StudioSidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      className="flex w-60 shrink-0 flex-col justify-between border-r border-neutral-200 bg-white p-4"
      aria-label="Studio navigation"
    >
      <div>
        <div className="mb-6 px-2">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          <p className="text-xs text-neutral-500">{roleLabel}</p>
        </div>

        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              item.href === "/studio" ? pathname === "/studio" : pathname.startsWith(item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          Log out
        </button>
      </form>
    </nav>
  );
}
