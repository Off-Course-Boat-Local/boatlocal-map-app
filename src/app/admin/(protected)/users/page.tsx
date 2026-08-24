import type { Metadata } from "next";

import AdminTable from "@/components/admin/AdminTable";
import InviteUserButton from "@/components/admin/InviteUserButton";
import { PageHeader } from "@/components/admin/primitives";
import StatusBadge from "@/components/admin/StatusBadge";
import UserRoleBadge from "@/components/admin/UserRoleBadge";
import UserRowActions from "@/components/admin/UserRowActions";
import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { requireAdminSession } from "@/lib/admin/devAuth";
import { listPlatformUsers, type PlatformUserStatus } from "@/lib/admin/users";
import { listCompanies } from "@/lib/data/source";

export const metadata: Metadata = { title: "Users" };

const STATUS_LABEL: Record<PlatformUserStatus, string> = {
  active: "Active",
  invited: "Invited",
  deactivated: "Deactivated",
};

const STATUS_TONE: Record<PlatformUserStatus, "positive" | "warning" | "neutral"> = {
  active: "positive",
  invited: "warning",
  deactivated: "neutral",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function displayDate(value: string | null): string {
  return value ? DATE_FORMAT.format(new Date(value)) : "—";
}

function initials(name: string | null, email: string): string {
  const source = name || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default async function AdminUsersPage() {
  // This page uses a service-role helper to include Auth metadata and pending
  // invite rows, so it performs its own Staff check rather than relying only
  // on the parent layout's render-time gate.
  await requireAdminSession();
  const [users, companies] = await Promise.all([
    listPlatformUsers(),
    listCompanies(ADMIN_ACTOR),
  ]);

  const activeCount = users.filter((user) => user.status === "active").length;
  const invitedCount = users.filter((user) => user.status === "invited").length;
  const rows = users.map((user) => {
    const userLabel = user.name || user.email;
    return [
      <div key="user" className="flex min-w-[230px] items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-nav-active-bg)] text-xs font-semibold text-[var(--admin-accent)]">
          {initials(user.name, user.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--admin-ink)]">
            {user.name || <span className="text-[var(--admin-ink-soft)]">Name not set</span>}
          </p>
          <p className="truncate text-xs text-[var(--admin-ink-soft)]">{user.email}</p>
        </div>
      </div>,
      <UserRoleBadge key="role" role={user.role} />,
      user.companyName ?? <span key="company" className="text-[var(--admin-ink-soft)]">—</span>,
      <StatusBadge
        key="status"
        status={STATUS_LABEL[user.status]}
        tone={STATUS_TONE[user.status]}
      />,
      <span key="created" className="whitespace-nowrap text-sm text-[var(--admin-ink-soft)]">
        {displayDate(user.createdAt)}
      </span>,
      <span key="active" className="whitespace-nowrap text-sm text-[var(--admin-ink-soft)]">
        {displayDate(user.lastActiveAt)}
      </span>,
      <UserRowActions key="actions" userName={userLabel} />,
    ];
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${users.length} user${users.length === 1 ? "" : "s"} across Staff, company admins, and guides.`}
        hint={`${activeCount} active · ${invitedCount} awaiting invitation acceptance`}
        action={<InviteUserButton companies={companies.map(({ id, name }) => ({ id, name }))} />}
      />

      <AdminTable
        columns={["User", "Role", "Company", "Status", "Joined", "Last active", "Actions"]}
        rows={rows}
        columnWidths={[
          "min-w-[260px]",
          "min-w-[130px]",
          "min-w-[170px]",
          "w-28",
          "min-w-[120px]",
          "min-w-[120px]",
          "w-20",
        ]}
        emptyMessage="No users yet — invite the first one above."
      />
    </div>
  );
}
