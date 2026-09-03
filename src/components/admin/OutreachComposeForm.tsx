"use client";

// Outreach detail page — the "send an email" box. Same useActionState +
// bound-Server-Action pattern as CreateCompanyForm.tsx, bound to this one
// prospect's id (matches setCompanyStatusAction.bind(...) elsewhere).
//
// Subject/body start prefilled from buildDefaultOutreachDraft (a first
// draft, see that file's own comment) but are ordinary editable fields —
// nothing stops the admin from rewriting the whole thing before sending.

import { useActionState, useEffect, useRef } from "react";

import { FIELD_CLASS, FIELD_LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/admin/primitives";
import { sendOutreachEmailAction, type OutreachActionResult } from "@/lib/admin/outreachActions";

const initialState: OutreachActionResult = {};

export interface OutreachComposeFormProps {
  prospectId: string;
  toEmail: string;
  defaultSubject: string;
  defaultBody: string;
  /** "Send" for the first outreach email, "Send follow-up" once one has already gone out. */
  submitLabel: string;
}

export default function OutreachComposeForm({
  prospectId,
  toEmail,
  defaultSubject,
  defaultBody,
  submitLabel,
}: OutreachComposeFormProps) {
  const action = sendOutreachEmailAction.bind(null, prospectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Unlike CreateCompanyForm, a successful send should NOT reset the form —
  // the admin likely wants to see exactly what they just sent (it stays
  // visible below in the timeline too, but leaving it in place here avoids
  // a jarring blank box right after clicking send).
  useEffect(() => {
    formRef.current?.querySelector("[role=status], [role=alert]")?.scrollIntoView?.({ block: "nearest" });
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <p className="text-xs text-[var(--admin-ink-soft)]">
        Sends to <span className="font-medium text-[var(--admin-ink)]">{toEmail}</span> via the same
        Resend setup Admin invites use.
      </p>

      <label className={FIELD_LABEL_CLASS}>
        Subject
        <input
          name="subject"
          required
          defaultValue={defaultSubject}
          className={`mt-1.5 ${FIELD_CLASS}`}
        />
      </label>

      <label className={FIELD_LABEL_CLASS}>
        Message
        <textarea
          name="body"
          required
          rows={9}
          defaultValue={defaultBody}
          className={`mt-1.5 ${FIELD_CLASS} font-sans`}
        />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? "Sending…" : submitLabel}
        </button>
        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p role="status" className="text-sm text-emerald-700">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
