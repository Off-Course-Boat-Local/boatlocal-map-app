"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  KeyRound,
  Send,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";

import PortalModal from "@/components/PortalModal";
import StatusBadge from "./StatusBadge";
import UserRoleBadge from "./UserRoleBadge";
import type { PlatformUserListItem, PlatformUserStatus } from "@/lib/admin/users";
import {
  deleteUserAction,
  resendUserInviteAction,
  sendUserPasswordResetAction,
  toggleUserStatusAction,
} from "@/lib/admin/userActions";

export interface UserDetailsModalProps {
  user: PlatformUserListItem | null;
  open: boolean;
  onClose: () => void;
}

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
  hour: "2-digit",
  minute: "2-digit",
});

function displayDate(value: string | null): string {
  return value ? DATE_FORMAT.format(new Date(value)) : "Never signed in";
}

function initials(name: string | null, email: string): string {
  const source = name || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function UserDetailsModal({ user, open, onClose }: UserDetailsModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  if (!user) return null;

  function handleResendInvite() {
    if (!user) return;
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await resendUserInviteAction(user.id);
        if (res.error) {
          setNotice({ text: res.error, type: "error" });
        } else {
          if (res.inviteUrl) setLastInviteUrl(res.inviteUrl);
          setNotice({
            text: res.emailSent
              ? `Invitation email successfully sent to ${user.email}.`
              : `Invite token refreshed. Copy the join link below.`,
            type: "success",
          });
          router.refresh();
        }
      } catch {
        setNotice({ text: "Failed to resend invitation.", type: "error" });
      }
    });
  }

  function handleSendPasswordReset() {
    if (!user) return;
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await sendUserPasswordResetAction(user.email);
        if (res.error) {
          setNotice({ text: res.error, type: "error" });
        } else {
          setNotice({
            text: `Password reset email sent to ${user.email}.`,
            type: "success",
          });
        }
      } catch {
        setNotice({ text: "Failed to send password reset.", type: "error" });
      }
    });
  }

  function handleToggleStatus() {
    if (!user) return;
    const nextStatus = user.status === "active" ? "deactivated" : "active";
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await toggleUserStatusAction(user.id, nextStatus);
        if (res.error) {
          setNotice({ text: res.error, type: "error" });
        } else {
          setNotice({
            text: `User is now ${nextStatus}.`,
            type: "success",
          });
          router.refresh();
        }
      } catch {
        setNotice({ text: "Failed to update status.", type: "error" });
      }
    });
  }

  function handleDelete() {
    if (!user) return;
    const prompt =
      user.status === "invited"
        ? `Revoke and delete invitation for ${user.email}?`
        : `Permanently delete user ${user.name || user.email}? This removes their authentication credentials.`;

    if (typeof window !== "undefined" && !window.confirm(prompt)) return;

    setNotice(null);
    startTransition(async () => {
      try {
        const res = await deleteUserAction(user.id);
        if (res.error) {
          setNotice({ text: res.error, type: "error" });
        } else {
          onClose();
          router.refresh();
        }
      } catch {
        setNotice({ text: "Failed to delete user.", type: "error" });
      }
    });
  }

  function copyToClipboard(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  return (
    <PortalModal
      open={open}
      onClose={onClose}
      title="User Details"
      maxWidthClassName="max-w-xl"
    >
      <div className="space-y-6">
        {/* Header Profile Hero */}
        <div className="flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--admin-nav-active-bg)] text-base font-bold text-[var(--admin-accent)] shadow-2xs">
            {initials(user.name, user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-bold text-[var(--admin-ink)]">
                {user.name || "Name not set"}
              </h2>
              <StatusBadge
                status={STATUS_LABEL[user.status]}
                tone={STATUS_TONE[user.status]}
              />
            </div>
            <p className="truncate text-xs text-[var(--admin-ink-soft)] mt-0.5">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <UserRoleBadge role={user.role} />
              {user.companyName && (
                <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 text-xs text-[var(--admin-ink)]">
                  {user.companyName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notice feedback */}
        {notice && (
          <div
            role="status"
            className={`rounded-xl px-3.5 py-2.5 text-xs font-medium ${
              notice.type === "success"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* User Metadata Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3.5">
            <div className="flex items-center gap-2 text-xs text-[var(--admin-ink-soft)] font-medium mb-1">
              <Calendar className="size-3.5" />
              <span>Created / Invited</span>
            </div>
            <p className="text-sm font-semibold text-[var(--admin-ink)]">
              {displayDate(user.createdAt)}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3.5">
            <div className="flex items-center gap-2 text-xs text-[var(--admin-ink-soft)] font-medium mb-1">
              <Clock className="size-3.5" />
              <span>Last active</span>
            </div>
            <p className="text-sm font-semibold text-[var(--admin-ink)]">
              {displayDate(user.lastActiveAt)}
            </p>
          </div>
        </div>

        {/* Direct Invite / Join Link Box (if refreshed or available) */}
        {lastInviteUrl && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                Direct Join Link:
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(lastInviteUrl)}
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--admin-accent)] hover:underline"
              >
                {copiedLink ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copiedLink ? "Copied" : "Copy Link"}
              </button>
            </div>
            <code className="block break-all rounded bg-white p-2 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200 border border-blue-100 dark:border-blue-900">
              {lastInviteUrl}
            </code>
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-2 pt-2 border-t border-[var(--admin-border)]">
          <p className="text-xs font-semibold text-[var(--admin-ink-soft)] uppercase tracking-wider mb-2">
            Account Management
          </p>

          <div className="flex flex-wrap gap-2.5">
            {user.status === "invited" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={handleResendInvite}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--admin-ink)] shadow-2xs transition-all hover:bg-[var(--admin-bg)] active:scale-98"
              >
                <Send className="size-3.5 text-[var(--admin-accent)]" />
                Resend Invitation
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={handleSendPasswordReset}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--admin-ink)] shadow-2xs transition-all hover:bg-[var(--admin-bg)] active:scale-98"
              >
                <KeyRound className="size-3.5 text-[var(--admin-accent)]" />
                Send Password Reset
              </button>
            )}

            {user.status !== "invited" && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleToggleStatus}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--admin-ink)] shadow-2xs transition-all hover:bg-[var(--admin-bg)] active:scale-98"
              >
                {user.status === "active" ? (
                  <>
                    <UserX className="size-3.5 text-amber-600" />
                    Deactivate User
                  </>
                ) : (
                  <>
                    <UserCheck className="size-3.5 text-emerald-600" />
                    Reactivate User
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-3.5 py-2 text-xs font-semibold text-red-700 shadow-2xs transition-all hover:bg-red-100/80 active:scale-98 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400"
            >
              <Trash2 className="size-3.5" />
              {user.status === "invited" ? "Revoke Invite" : "Delete User"}
            </button>
          </div>
        </div>
      </div>
    </PortalModal>
  );
}
