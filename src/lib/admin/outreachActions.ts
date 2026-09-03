"use server";

// Affiliate outreach — Server Actions. Same shape as companyActions.ts:
// each action re-checks requireAdminSession() itself (defence-in-depth
// layer #3, same as that file), then calls the plain data-access functions
// in src/lib/data/outreach.ts, which re-check actor.role and are backstopped
// by RLS's admin_full_access policy on both outreach tables.
//
// The cadence state machine lives entirely in here, not in outreach.ts:
// outreach.ts is deliberately dumb storage (read rows, write rows, log an
// event); deciding what next_action_type/next_action_due_at becomes after
// each event is a business rule, and this is where every other admin
// write-side decision in the app already lives (companyActions.ts,
// guideActions.ts).

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin/devAuth";
import { createCompany } from "@/lib/data/source";
import {
  getOutreachProspect,
  listOutreachEvents,
  logOutreachEvent,
  updateOutreachProspect,
  upsertOutreachProspectsFromCsv,
  type OutreachActionType,
} from "@/lib/data/outreach";
import { isEmailConfigured, sendEmail } from "@/lib/email/client";
import { plainOutreachEmail } from "@/lib/email/templates";

import { ADMIN_ACTOR } from "./actor";
import { parseOutreachCsv } from "./outreachCsv";
import { sendOwnerInvite } from "./ownerInvite";

/** Both configurable per .env.example; 4/4 matches the founder's own default cadence. */
const REMINDER_DAYS = Number(process.env.OUTREACH_REMINDER_DAYS ?? "4");
const CALL_DAYS = Number(process.env.OUTREACH_CALL_DAYS ?? "4");

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function revalidateOutreach(prospectId: string) {
  revalidatePath("/admin/outreach");
  revalidatePath(`/admin/outreach/${prospectId}`);
}

export interface OutreachActionResult {
  error?: string;
  message?: string;
}

/**
 * Bulk-imports/refreshes prospects from an uploaded research CSV — the
 * admin-UI equivalent of running scripts/import-outreach-prospects.mjs by
 * hand. Parsing (parseOutreachCsv) and the non-destructive upsert
 * (upsertOutreachProspectsFromCsv) do the actual work; this just wires the
 * uploaded File into that pipeline, same requireAdminSession() + revalidate
 * shape every other action here uses.
 */
export async function importOutreachCsvAction(
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to import." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { error: "That doesn't look like a CSV file." };
  }

  const text = await file.text();
  const { records, skippedNames } = parseOutreachCsv(text);
  if (records.length === 0) {
    return { error: "No prospects found in that file — check it has a Name column." };
  }

  const { created, updated } = await upsertOutreachProspectsFromCsv(ADMIN_ACTOR, records);

  revalidatePath("/admin/outreach");

  const skippedNote = skippedNames.length > 0 ? `, skipped ${skippedNames.length} excluded` : "";
  return {
    message: `Imported ${created} new prospect${created === 1 ? "" : "s"}, updated ${updated} existing${skippedNote}.`,
  };
}

/**
 * Sends the composed email via Resend and advances the pipeline.
 *
 * Cadence: the FIRST email_sent event for a prospect schedules a follow-up
 * EMAIL in REMINDER_DAYS; the second (and any later) schedules a CALL in
 * CALL_DAYS instead — i.e. "send once, if nothing happens nudge again by
 * email, if still nothing pick up the phone" rather than emailing forever.
 * Counted from the actual event log (not a separate counter column) so
 * there is exactly one source of truth for "how many times have we emailed
 * this prospect" — the timeline the admin already sees on the detail page.
 */
export async function sendOutreachEmailAction(
  prospectId: string,
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const prospect = await getOutreachProspect(ADMIN_ACTOR, prospectId);
  if (!prospect) return { error: "This prospect no longer exists." };
  if (!prospect.email) return { error: "This prospect has no email address on file." };

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject) return { error: "Subject is required." };
  if (!body) return { error: "Email body is required." };

  if (!isEmailConfigured()) {
    return { error: "Email is not configured (RESEND_API_KEY / RESEND_FROM missing)." };
  }

  const rendered = plainOutreachEmail({ subject, bodyText: body });
  const sent = await sendEmail({ to: prospect.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
  if (!sent.ok) {
    return { error: `Could not send: ${sent.error}` };
  }

  await logOutreachEvent(ADMIN_ACTOR, {
    prospectId,
    eventType: "email_sent",
    body: `${subject}\n\n${body}`,
  });

  const priorEmails = (await listOutreachEvents(ADMIN_ACTOR, prospectId)).filter(
    (e) => e.eventType === "email_sent",
  ).length;
  const isFirstEmail = priorEmails <= 1; // includes the one just logged

  const nextActionType: OutreachActionType = isFirstEmail ? "email_reminder" : "call";
  const nextActionDueAt = addDays(isFirstEmail ? REMINDER_DAYS : CALL_DAYS);

  await updateOutreachProspect(ADMIN_ACTOR, prospectId, {
    status: "emailed",
    lastContactedAt: new Date().toISOString(),
    nextActionType,
    nextActionDueAt,
  });

  revalidateOutreach(prospectId);
  return { message: `Email sent to ${prospect.email}.` };
}

/**
 * Logs a call attempt. Does not by itself close the prospect out — the
 * admin still has "Mark replied"/"Mark declined" for that — it just records
 * that contact was attempted and, by default, schedules ANOTHER call in
 * CALL_DAYS so a phone-tag situation keeps resurfacing instead of quietly
 * falling off the list.
 */
export async function logCallAction(
  prospectId: string,
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const note = String(formData.get("note") ?? "").trim();

  await logOutreachEvent(ADMIN_ACTOR, {
    prospectId,
    eventType: "call_logged",
    body: note || null,
  });

  await updateOutreachProspect(ADMIN_ACTOR, prospectId, {
    lastContactedAt: new Date().toISOString(),
    nextActionType: "call",
    nextActionDueAt: addDays(CALL_DAYS),
  });

  revalidateOutreach(prospectId);
  return { message: "Call logged." };
}

/** Free-form research note — no status change, nothing scheduled. */
export async function addOutreachNoteAction(
  prospectId: string,
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Note is empty." };

  await logOutreachEvent(ADMIN_ACTOR, { prospectId, eventType: "note", body: note });
  revalidateOutreach(prospectId);
  return { message: "Note added." };
}

/** Closes the prospect out as replied (interested) — clears the pending action; nothing more is due. */
export async function markOutreachRepliedAction(
  prospectId: string,
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const note = String(formData.get("note") ?? "").trim();

  await logOutreachEvent(ADMIN_ACTOR, { prospectId, eventType: "replied", body: note || null });
  await updateOutreachProspect(ADMIN_ACTOR, prospectId, {
    status: "replied",
    nextActionType: null,
    nextActionDueAt: null,
  });

  revalidateOutreach(prospectId);
  return { message: "Marked as replied." };
}

/** Closes the prospect out as declined — clears the pending action; nothing more is due. */
export async function markOutreachDeclinedAction(
  prospectId: string,
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const note = String(formData.get("note") ?? "").trim();

  await logOutreachEvent(ADMIN_ACTOR, { prospectId, eventType: "declined", body: note || null });
  await updateOutreachProspect(ADMIN_ACTOR, prospectId, {
    status: "declined",
    nextActionType: null,
    nextActionDueAt: null,
  });

  revalidateOutreach(prospectId);
  return { message: "Marked as declined." };
}

/**
 * Graduates a replied/interested prospect into a real tenant: creates the
 * `companies` row via the existing onboarding path (src/lib/data/source.ts
 * createCompany, the same function Admin's "Create company" button uses)
 * and sends the same owner-invite email a manually-created company gets,
 * then links company_id back onto this prospect row so its outreach history
 * stays traceable from the Companies list too.
 *
 * Mirrors createCompanyAction's own two-step shape in companyActions.ts:
 * the company is created and committed FIRST; the invite send is a
 * separate best-effort step, because a failed send must never read as "the
 * company wasn't created" (it was) — see that action's own comment.
 */
export async function onboardOutreachProspectAction(
  prospectId: string,
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const prospect = await getOutreachProspect(ADMIN_ACTOR, prospectId);
  if (!prospect) return { error: "This prospect no longer exists." };

  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();
  if (!ownerEmail) return { error: "Owner's email is required." };

  let companyId: string;
  try {
    const created = await createCompany(ADMIN_ACTOR, {
      name: prospect.name,
      companyType: prospect.tourType || undefined,
      ownerEmail,
    });
    companyId = created.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the company." };
  }

  await updateOutreachProspect(ADMIN_ACTOR, prospectId, {
    status: "onboarded",
    nextActionType: null,
    nextActionDueAt: null,
    companyId,
  });
  await logOutreachEvent(ADMIN_ACTOR, {
    prospectId,
    eventType: "onboarded",
    body: `Onboarded as a company (owner invited at ${ownerEmail}).`,
  });

  const send = await sendOwnerInvite(companyId);
  const message =
    send.status === "failed"
      ? `Company created, but the invite email could not be sent (${send.error}). Send the invite link manually from Companies.`
      : "Onboarded — owner invite sent.";

  revalidateOutreach(prospectId);
  revalidatePath("/admin/companies");
  revalidatePath("/admin");
  return { message };
}
