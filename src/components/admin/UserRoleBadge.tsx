import type { PlatformUserRole } from "@/lib/admin/users";
import { USER_ROLE_LABEL } from "@/lib/admin/users";

const ROLE_CLASSES: Record<PlatformUserRole, string> = {
  admin: "bg-blue-500/10 text-blue-700",
  company: "bg-violet-500/10 text-violet-700",
  guide: "bg-cyan-500/10 text-cyan-800",
};

export default function UserRoleBadge({ role }: { role: PlatformUserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${ROLE_CLASSES[role]}`}
    >
      {USER_ROLE_LABEL[role]}
    </span>
  );
}
