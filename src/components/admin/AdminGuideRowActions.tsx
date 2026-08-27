"use client";

import { useState, useTransition } from "react";
import { CopyIcon, EyeIcon, CheckCircleIcon, ArchiveIcon } from "@/components/PortalIcons";
import PortalRowMenu, { type PortalRowMenuItem } from "@/components/PortalRowMenu";
import { setAdminGuideActiveAction } from "@/lib/admin/guideActions";

export interface AdminGuideRowActionsProps {
  guideId: string;
  guideName: string;
  guideSlug: string;
  companyId: string;
  status: "invited" | "active" | "deactivated";
  origin: string;
}

export default function AdminGuideRowActions({
  guideId,
  guideName,
  guideSlug,
  companyId,
  status,
  origin,
}: AdminGuideRowActionsProps) {
  const [statusMessage, setStatusMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const mapUrl = `${origin}/?company=${companyId}&guide=${guideSlug}`;
  const isDeactivated = status === "deactivated";

  const items: PortalRowMenuItem[] = [
    {
      label: "Copy map link",
      icon: CopyIcon,
      onSelect: () => {
        navigator.clipboard
          .writeText(mapUrl)
          .then(() => {
            setStatusMessage({ tone: "success", text: "Map link copied." });
            setTimeout(() => setStatusMessage(null), 2500);
          })
          .catch(() => {
            setStatusMessage({ tone: "error", text: "Failed to copy link." });
            setTimeout(() => setStatusMessage(null), 2500);
          });
      },
    },
    {
      label: "Open guest map",
      icon: EyeIcon,
      onSelect: () => {
        window.open(mapUrl, "_blank", "noopener,noreferrer");
      },
    },
    {
      label: isDeactivated ? "Reactivate guide" : "Deactivate guide",
      icon: isDeactivated ? CheckCircleIcon : ArchiveIcon,
      tone: isDeactivated ? "default" : "danger",
      disabled: isPending,
      onSelect: () => {
        startTransition(async () => {
          await setAdminGuideActiveAction(guideId, isDeactivated);
          setStatusMessage({
            tone: "success",
            text: isDeactivated ? "Guide reactivated." : "Guide deactivated.",
          });
          setTimeout(() => setStatusMessage(null), 2500);
        });
      },
    },
  ];

  return (
    <div className="flex flex-col items-end gap-1">
      <PortalRowMenu items={items} label={`Actions for ${guideName}`} />
      {statusMessage ? (
        <p
          role={statusMessage.tone === "error" ? "alert" : "status"}
          className={`text-[11px] font-medium ${
            statusMessage.tone === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {statusMessage.text}
        </p>
      ) : null}
    </div>
  );
}
