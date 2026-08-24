"use client";

// The "Create company" pop-up trigger — the button and its dialog travel
// together so a Create-company button placed anywhere in the app opens the
// same PortalModal (src/components/PortalModal.tsx), per the founder's call
// ("a pop-up, just the same way we create recommendations") documented in
// docs/admin-create-company-modal-handover.md. That handover note left this
// exact wiring as the one remaining step; this is it.

import { Plus } from "lucide-react";
import { useState } from "react";

import PortalModal from "@/components/PortalModal";
import { PRIMARY_BUTTON_CLASS } from "@/components/admin/primitives";
import CreateCompanyForm from "./CreateCompanyForm";

export default function CreateCompanyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BUTTON_CLASS}>
        <Plus className="size-4" strokeWidth={2} />
        Create company
      </button>

      <PortalModal
        open={open}
        onClose={() => setOpen(false)}
        title="Onboard a new company"
        maxWidthClassName="max-w-2xl"
      >
        <CreateCompanyForm onDone={() => setOpen(false)} />
      </PortalModal>
    </>
  );
}
