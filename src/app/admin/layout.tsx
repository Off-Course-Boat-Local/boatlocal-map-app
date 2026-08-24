import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./admin-theme.css";

// Shared shell for everything under /admin — both the (public) login page
// and the (protected) authenticated area. Auth gating itself lives one
// level down, in the (protected) segment's layout, so the login page is
// never wrapped by a check that would redirect it back to itself.
export const metadata: Metadata = {
  title: {
    default: "Map App Admin",
    template: "%s · Map App Admin",
  },
  description:
    "Map App staff console — platform overview, users, boat catalog, companies, and guides.",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
