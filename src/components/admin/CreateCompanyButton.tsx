"use client";

// The "Create company" pop-up trigger — the button and its dialog travel
// together so a Create-company button placed anywhere in the app opens the
// same PortalModal (src/components/PortalModal.tsx), per the founder's call
// ("a pop-up, just the same way we create recommendations") documented in
// docs/admin-create-company-modal-handover.md. That handover note left this
// exact wiring as the one remaining step; this is it.

import { useState } from "react";

import PortalModal from "@/components/PortalModal";
import CreateCompanyForm from "./CreateCompanyForm";

export default function CreateCompanyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--admin-accent-strong)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
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
