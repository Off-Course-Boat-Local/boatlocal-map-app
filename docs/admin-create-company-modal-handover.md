# Handover: "Create company" as a pop-up

**For whoever owns the Admin portal.** The founder wants company creation to
work like adding a recommendation in Studio — a **Create company** button at
the top right that opens a dialog — instead of the onboarding form sitting
permanently across the top of the Companies page. And a Create-company button
placed anywhere else in the app should open that same dialog.

I've built the shared piece. The Admin-side change is small, and I haven't
touched `src/app/admin/**`, `src/lib/admin/**` or `src/components/admin/**`.

## What already exists

**`src/components/PortalModal.tsx`** — new, in shared portal space alongside
`PortalSelect` / `PortalToggle` / `PortalIcons`. It is the dialog extracted
from Studio's add/edit-a-place pop-up, so Admin's dialog and Studio's are
literally the same component and cannot drift.

```tsx
<PortalModal open={open} onClose={close} title="Onboard a new company">
  {children}
</PortalModal>
```

Props: `open`, `onClose`, `title`, `children`, and optional
`maxWidthClassName` (defaults to `max-w-lg`; the onboarding form is a 5-column
grid, so it likely wants `max-w-3xl`).

It handles Escape, backdrop click, body scroll lock, `role="dialog"` +
`aria-modal` + `aria-labelledby`, focus into the first field on open, focus
restored to the trigger on close, and a Tab trap. Studio's recommendations
dialog already runs on it — verified in the browser.

## What's left on your side

**1. `CreateCompanyForm` takes an `onDone?: () => void`.** It already detects
success (`state.success`, which resets the form). Add the callback next to
that reset:

```tsx
useEffect(() => {
  if (!state.success) return;
  formRef.current?.reset();
  onDone?.();
}, [state, onDone]);
```

**One thing to get right:** `CreateCompanyActionState` has a third case,
`inviteWarning` — the company was created but the invite email didn't go out.
That must **not** close the dialog, because the operator needs to read the
warning and go get the copy-able invite link; and re-submitting would fail on
subdomain uniqueness. So gate the close on success *without* a warning:

```tsx
if (state.success && !state.inviteWarning) onDone?.();
```

**2. A small client wrapper, `src/components/admin/CreateCompanyButton.tsx`** —
this is the bit that makes "a Create-company button anywhere opens the pop-up"
true, since the button and its dialog travel together:

```tsx
"use client";
import { useState } from "react";
import PortalModal from "@/components/PortalModal";
import CreateCompanyForm from "./CreateCompanyForm";

export default function CreateCompanyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={/* admin primary button */}>
        Create company
      </button>
      <PortalModal
        open={open}
        onClose={() => setOpen(false)}
        title="Onboard a new company"
        maxWidthClassName="max-w-3xl"
      >
        <CreateCompanyForm onDone={() => setOpen(false)} />
      </PortalModal>
    </>
  );
}
```

**3. `src/app/admin/(protected)/companies/page.tsx`** — drop
`<CreateCompanyForm />` (currently line 137) and put `<CreateCompanyButton />`
in the page header row, right-aligned.

Two bits of the form's own chrome become redundant once it's in a dialog: its
outer `rounded-lg border … p-4` card (the dialog card provides that) and its
"Onboard a new company" heading (now the dialog title). The explanatory
paragraph beneath it is worth keeping inside the dialog.

## Naming

The founder said "Create Company"; existing Admin copy says "Onboard a new
company". I'd use **Create company** on the button (it's what was asked for,
and it's what the action does) and keep the longer phrasing as the dialog
title. Your call — just don't leave both spellings on the button.

## Not in scope here

Nothing about `createCompanyAction`, `createCompany`, or the owner-invite
send/resend path changes. This is presentation only.

---

Also, separately: **`profiles` now rejects self-service role changes.**
`supabase/migrations/20260822090000_profiles_privileged_columns_guard.sql`
adds a `BEFORE UPDATE` trigger making `role` / `company_id` / `guide_id`
immutable to the account itself, because any signed-in Studio user could
previously `PATCH` their own row to `role='admin'` with the public anon key
and become Staff (confirmed exploitable against the dev project, row
restored). Service-role writes and Staff sessions are both exempt, and
nothing in Admin performs an UPDATE on `profiles` — the allowlist bootstrap
in `src/lib/admin/devAuth.ts` is an INSERT, which the trigger doesn't touch.
Nothing for you to change; flagging it because it's shared surface.
