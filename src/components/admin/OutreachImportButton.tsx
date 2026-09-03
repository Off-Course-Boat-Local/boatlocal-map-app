"use client";

// The "Import CSV" pop-up trigger on the Outreach list page — same
// button+PortalModal wiring as CreateCompanyButton.tsx, so a new-prospect
// research upload opens the same kind of dialog "Create company" does
// rather than inventing a second dialog pattern.

import { Upload } from "lucide-react";
import { useState } from "react";

import PortalModal from "@/components/PortalModal";
import { PRIMARY_BUTTON_CLASS } from "@/components/admin/primitives";
import OutreachImportForm from "./OutreachImportForm";

export default function OutreachImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BUTTON_CLASS}>
        <Upload className="size-4" strokeWidth={2} />
        Import CSV
      </button>

      <PortalModal
        open={open}
        onClose={() => setOpen(false)}
        title="Import prospects from CSV"
        maxWidthClassName="max-w-lg"
      >
        <OutreachImportForm />
      </PortalModal>
    </>
  );
}
