"use client";

import { useState, useTransition } from "react";
import { Eye, KeyRound, RotateCcw, Send, Trash2, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";

import PortalRowMenu, { type PortalRowMenuItem } from "@/components/PortalRowMenu";
import type { PlatformUserListItem } from "@/lib/admin/users";
import {
  deleteUserAction,
  resendUserInviteAction,
  sendUserPasswordResetAction,
  toggleUserStatusAction,
} from "@/lib/admin/userActions";
import UserDetailsModal from "./UserDetailsModal";

export interface UserRowActionsProps {
  user: PlatformUserListItem;
}

export default function UserRowActions({ user }: UserRowActionsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleResendInvite() {
    startTransition(async () => {
      try {
        const res = await resendUserInviteAction(user.id);
        if (res.error) {
          alert(`Error: ${res.error}`);
        } else {
          alert(
            res.emailSent
              ? `Invitation email successfully resent to ${user.email}.`
              : `Invitation token refreshed. (Link: ${res.inviteUrl})`
          );
          router.refresh();
        }
      } catch {
        alert("Failed to resend invitation.");
      }
    });
  }

  function handleSendPasswordReset() {
    startTransition(async () => {
      try {
        const res = await sendUserPasswordResetAction(user.email);
        if (res.error) {
          alert(`Error: ${res.error}`);
        } else {
          alert(`Password reset link sent to ${user.email}.`);
        }
      } catch {
        alert("Failed to send password reset email.");
      }
    });
  }

  function handleToggleStatus() {
    const nextStatus = user.status === "active" ? "deactivated" : "active";
    startTransition(async () => {
      try {
        const res = await toggleUserStatusAction(user.id, nextStatus);
        if (res.error) {
          alert(`Error: ${res.error}`);
        } else {
          router.refresh();
        }
      } catch {
        alert("Failed to update status.");
      }
    });
  }

  function handleDelete() {
    const prompt =
      user.status === "invited"
        ? `Revoke and delete invitation for ${user.email}?`
        : `Permanently delete user ${user.name || user.email}? This removes their authentication credentials.`;

    if (typeof window !== "undefined" && !window.confirm(prompt)) return;

    startTransition(async () => {
      try {
        const res = await deleteUserAction(user.id);
        if (res.error) {
          alert(`Error: ${res.error}`);
        } else {
          router.refresh();
        }
      } catch {
        alert("Failed to delete user.");
      }
    });
  }

  const menuItems: PortalRowMenuItem[] = [
    {
      label: "View details",
      icon: Eye,
      onSelect: () => setShowDetails(true),
    },
    ...(user.status === "invited"
      ? [
          {
            label: "Resend invitation",
            icon: Send,
            disabled: isPending,
            onSelect: handleResendInvite,
          },
        ]
      : [
          {
            label: "Send password reset",
            icon: KeyRound,
            disabled: isPending,
            onSelect: handleSendPasswordReset,
          },
        ]),
    ...(user.status !== "invited"
      ? [
          {
            label: user.status === "active" ? "Deactivate user" : "Reactivate user",
            icon: user.status === "active" ? UserX : UserCheck,
            disabled: isPending,
            onSelect: handleToggleStatus,
          },
        ]
      : []),
    {
      label: user.status === "invited" ? "Revoke invitation" : "Delete user",
      icon: Trash2,
      tone: "danger",
      disabled: isPending,
      onSelect: handleDelete,
    },
  ];

  const userLabel = user.name || user.email;

  return (
    <>
      <PortalRowMenu items={menuItems} label={`Actions for ${userLabel}`} />
      <UserDetailsModal
        user={user}
        open={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </>
  );
}
