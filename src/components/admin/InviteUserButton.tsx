"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";

import PortalModal from "@/components/PortalModal";
import { PRIMARY_BUTTON_CLASS } from "@/components/admin/primitives";
import InviteUserForm, { type InviteUserCompanyOption } from "./InviteUserForm";

export default function InviteUserButton({ companies }: { companies: InviteUserCompanyOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BUTTON_CLASS}>
        <UserPlus className="size-4" strokeWidth={2} />
        Invite User
      </button>
      <PortalModal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a user"
        maxWidthClassName="max-w-xl"
      >
        <InviteUserForm companies={companies} onDone={() => setOpen(false)} />
      </PortalModal>
    </>
  );
}
