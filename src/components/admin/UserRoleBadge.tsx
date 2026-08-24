import type { PlatformUserRole } from "@/lib/admin/users";

const ROLE_CLASSES: Record<PlatformUserRole, string> = {
  admin: "bg-blue-500/10 text-blue-700",
  company: "bg-violet-500/10 text-violet-700",
  guide: "bg-cyan-500/10 text-cyan-800",
};

/**
 * Deliberately shorter than USER_ROLE_LABEL (src/lib/admin/users.ts):
 * that constant also feeds the invite email's body copy ("You're invited
 * to Map App as Company admin"), where the fuller phrase actually earns
 * its length. Crammed into a pill next to a Company column that already
 * names the company, "Company admin" wrapped and looked cramped — "Admin"
 * alone reads fine in that context and isn't ambiguous with Staff, which
 * keeps its own distinct label and colour.
 */
const ROLE_BADGE_LABEL: Record<PlatformUserRole, string> = {
  admin: "Staff",
  company: "Admin",
  guide: "Guide",
};

export default function UserRoleBadge({ role }: { role: PlatformUserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold whitespace-nowrap ${ROLE_CLASSES[role]}`}
    >
      {ROLE_BADGE_LABEL[role]}
    </span>
  );
}
