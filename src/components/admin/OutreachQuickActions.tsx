"use client";

// Outreach detail page — everything besides sending an email: logging a
// call, jotting a free-form note, and the three ways a prospect leaves the
// active pipeline (replied/declined/onboarded). Each is its own small
// useActionState form bound to this prospect's id, same pattern as
// OutreachComposeForm.tsx — kept as separate forms rather than one giant
// form so each has its own pending/error state and none of them can
// accidentally submit another's fields.

import { useActionState, useState } from "react";

import {
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/admin/primitives";
import {
  addOutreachNoteAction,
  logCallAction,
  markOutreachDeclinedAction,
  markOutreachRepliedAction,
  onboardOutreachProspectAction,
  type OutreachActionResult,
} from "@/lib/admin/outreachActions";

const initialState: OutreachActionResult = {};

function ResultLine({ state }: { state: OutreachActionResult }) {
  if (state.error) {
    return (
      <p role="alert" className="mt-2 text-sm text-red-600">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="mt-2 text-sm text-emerald-700">
        {state.message}
      </p>
    );
  }
  return null;
}

function LogCallForm({ prospectId }: { prospectId: string }) {
  const [state, formAction, pending] = useActionState(logCallAction.bind(null, prospectId), initialState);
  return (
    <form action={formAction}>
      <label className={FIELD_LABEL_CLASS}>
        Log a call
        <textarea
          name="note"
          rows={2}
          placeholder="e.g. Left voicemail, said they'd call back this week"
          className={`mt-1.5 ${FIELD_CLASS}`}
        />
      </label>
      <button type="submit" disabled={pending} className={`mt-2 ${GHOST_BUTTON_CLASS}`}>
        {pending ? "Logging…" : "Log call"}
      </button>
      <ResultLine state={state} />
    </form>
  );
}

function AddNoteForm({ prospectId }: { prospectId: string }) {
  const [state, formAction, pending] = useActionState(
    addOutreachNoteAction.bind(null, prospectId),
    initialState,
  );
  return (
    <form action={formAction}>
      <label className={FIELD_LABEL_CLASS}>
        Add a note
        <textarea name="note" rows={2} placeholder="Research context, anything worth remembering" className={`mt-1.5 ${FIELD_CLASS}`} />
      </label>
      <button type="submit" disabled={pending} className={`mt-2 ${GHOST_BUTTON_CLASS}`}>
        {pending ? "Saving…" : "Add note"}
      </button>
      <ResultLine state={state} />
    </form>
  );
}

function CloseOutForm({
  prospectId,
  kind,
}: {
  prospectId: string;
  kind: "replied" | "declined";
}) {
  const boundAction = kind === "replied" ? markOutreachRepliedAction : markOutreachDeclinedAction;
  const [state, formAction, pending] = useActionState(boundAction.bind(null, prospectId), initialState);
  const label = kind === "replied" ? "Mark replied" : "Mark declined";
  const buttonClass =
    kind === "replied"
      ? "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      : "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--admin-border)] px-4 py-2.5 text-sm font-medium text-[var(--admin-ink-soft)] transition-colors hover:bg-[var(--admin-bg)] disabled:opacity-50";

  return (
    <form action={formAction} className="flex-1">
      <input type="hidden" name="note" value="" />
      <button type="submit" disabled={pending} className={`w-full ${buttonClass}`}>
        {pending ? "Saving…" : label}
      </button>
      <ResultLine state={state} />
    </form>
  );
}

function OnboardForm({ prospectId, prefillEmail }: { prospectId: string; prefillEmail: string }) {
  const [state, formAction, pending] = useActionState(
    onboardOutreachProspectAction.bind(null, prospectId),
    initialState,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`w-full ${PRIMARY_BUTTON_CLASS}`}>
        Onboard as a company
      </button>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border border-[var(--admin-border)] p-3.5">
      <p className="text-xs text-[var(--admin-ink-soft)]">
        Creates a real company (same flow as Admin &gt; Companies &gt; Create company) and emails this
        address an invite to set up their account.
      </p>
      <label className={`mt-2 block ${FIELD_LABEL_CLASS}`}>
        Owner&rsquo;s email
        <input
          name="ownerEmail"
          type="email"
          required
          defaultValue={prefillEmail}
          className={`mt-1.5 ${FIELD_CLASS}`}
        />
      </label>
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? "Onboarding…" : "Confirm — onboard"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-[var(--admin-ink-soft)]">
          Cancel
        </button>
      </div>
      <ResultLine state={state} />
    </form>
  );
}

export interface OutreachQuickActionsProps {
  prospectId: string;
  status: string;
  prefillOwnerEmail: string;
}

export default function OutreachQuickActions({
  prospectId,
  status,
  prefillOwnerEmail,
}: OutreachQuickActionsProps) {
  const isOpen = status !== "replied" && status !== "declined" && status !== "onboarded";

  return (
    <div className="space-y-5">
      {isOpen ? (
        <div className="flex gap-3">
          <CloseOutForm prospectId={prospectId} kind="replied" />
          <CloseOutForm prospectId={prospectId} kind="declined" />
        </div>
      ) : null}

      {status === "replied" ? <OnboardForm prospectId={prospectId} prefillEmail={prefillOwnerEmail} /> : null}

      <div className="border-t border-[var(--admin-border)] pt-4">
        <LogCallForm prospectId={prospectId} />
      </div>
      <div className="border-t border-[var(--admin-border)] pt-4">
        <AddNoteForm prospectId={prospectId} />
      </div>
    </div>
  );
}
