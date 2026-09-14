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
  deleteOutreachProspect,
  getOutreachProspect,
  listOutreachEvents,
  logOutreachEvent,
  updateOutreachProspect,
  upsertOutreachProspectsFromCsv,
  type OutreachActionType,
  type OutreachEventType,
} from "@/lib/data/outreach";
import { isEmailConfigured, sendEmail } from "@/lib/email/client";
import { plainOutreachEmail } from "@/lib/email/templates";

import { ADMIN_ACTOR } from "./actor";
import { parseOutreachCsv } from "./outreachCsv";
import { sendOwnerInvite } from "./ownerInvite";
import { OUTREACH_STATUS_LABELS, type OutreachStatus } from "./outreachStatus";
import { CHANNEL_META, type OutreachChannel } from "./outreachTouchpoints";

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

  const toEmail = String(formData.get("toEmail") ?? prospect.email ?? "").trim();
  if (!toEmail) return { error: "Please provide a recipient email address." };

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject) return { error: "Subject is required." };
  if (!body) return { error: "Email body is required." };

  if (!isEmailConfigured()) {
    return { error: "Email is not configured (RESEND_API_KEY / RESEND_FROM missing)." };
  }

  const rendered = plainOutreachEmail({ subject, bodyText: body });
  const sent = await sendEmail({ to: toEmail, subject: rendered.subject, html: rendered.html, text: rendered.text });
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
    ...(prospect.email ? {} : { email: toEmail }),
  });

  revalidateOutreach(prospectId);
  return { message: `Email sent to ${toEmail}.` };
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
  const prospect = await getOutreachProspect(ADMIN_ACTOR, prospectId);
  if (!prospect) return { error: "This prospect no longer exists." };

  await logOutreachEvent(ADMIN_ACTOR, {
    prospectId,
    eventType: "call_logged",
    body: note || null,
  });

  const patch: Parameters<typeof updateOutreachProspect>[2] = {
    lastContactedAt: new Date().toISOString(),
    nextActionType: "call",
    nextActionDueAt: addDays(CALL_DAYS),
  };

  if (prospect.status === "not_contacted") {
    patch.status = "emailed";
  }

  await updateOutreachProspect(ADMIN_ACTOR, prospectId, patch);

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
 * Updates a prospect's status directly to any valid pipeline state.
 * Adjusts nextActionType / nextActionDueAt to match the new status
 * and logs an event in the timeline.
 */
export async function updateOutreachStatusAction(
  prospectId: string,
  newStatus: OutreachStatus,
  note?: string,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const validStatuses: OutreachStatus[] = ["not_contacted", "emailed", "replied", "declined", "onboarded"];
  if (!validStatuses.includes(newStatus)) {
    return { error: `Invalid status: ${newStatus}` };
  }

  const prospect = await getOutreachProspect(ADMIN_ACTOR, prospectId);
  if (!prospect) return { error: "This prospect no longer exists." };

  if (prospect.status === newStatus && !note) {
    return { message: "Status unchanged." };
  }

  const patch: Parameters<typeof updateOutreachProspect>[2] = {
    status: newStatus,
  };

  if (
    newStatus === "replied" ||
    newStatus === "declined" ||
    newStatus === "onboarded" ||
    newStatus === "not_contacted"
  ) {
    patch.nextActionType = null;
    patch.nextActionDueAt = null;
  } else if (newStatus === "emailed") {
    if (!prospect.lastContactedAt) {
      patch.lastContactedAt = new Date().toISOString();
    }
    if (!prospect.nextActionType) {
      patch.nextActionType = "email_reminder";
      patch.nextActionDueAt = addDays(REMINDER_DAYS);
    }
  }

  await updateOutreachProspect(ADMIN_ACTOR, prospectId, patch);

  const trimmedNote = note?.trim();
  const eventBody =
    trimmedNote ||
    (prospect.status !== newStatus
      ? `Status changed from ${OUTREACH_STATUS_LABELS[prospect.status]} to ${OUTREACH_STATUS_LABELS[newStatus]}.`
      : `Status set to ${OUTREACH_STATUS_LABELS[newStatus]}.`);

  let eventType: OutreachEventType = "note";
  if (newStatus === "replied") eventType = "replied";
  else if (newStatus === "declined") eventType = "declined";
  else if (newStatus === "onboarded") eventType = "onboarded";
  else eventType = "note";

  await logOutreachEvent(ADMIN_ACTOR, {
    prospectId,
    eventType,
    body: eventBody,
  });

  revalidateOutreach(prospectId);
  return { message: `Status updated to ${OUTREACH_STATUS_LABELS[newStatus]}.` };
}

export async function updateOutreachStatusFormAction(
  prospectId: string,
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  const newStatus = formData.get("status") as OutreachStatus;
  const note = String(formData.get("note") ?? "").trim();
  return updateOutreachStatusAction(prospectId, newStatus, note);
}

export interface LogTouchpointInput {
  channel: OutreachChannel;
  note: string;
  nextActionDueAt?: string | null;
  nextActionType?: OutreachActionType | null;
}

/**
 * Logs an outreach touchpoint across any channel (WhatsApp, meeting proposed,
 * meeting held, call, in-person visit, direct email, or note).
 *
 * Saves a timeline event formatted with the channel prefix (e.g. `[WhatsApp] ...`),
 * updates `lastContactedAt = now()`, advances `status` from `not_contacted` to `emailed`
 * (if not already further in the pipeline), and optionally schedules the next follow-up.
 */
export async function logOutreachTouchpointAction(
  prospectId: string,
  input: LogTouchpointInput,
): Promise<OutreachActionResult> {
  await requireAdminSession();

  const note = input.note?.trim();
  if (!note) {
    return { error: "Please write a brief note about this touchpoint." };
  }

  const prospect = await getOutreachProspect(ADMIN_ACTOR, prospectId);
  if (!prospect) return { error: "This prospect no longer exists." };

  const meta = CHANNEL_META[input.channel] ?? CHANNEL_META.note;
  const prefix = meta.defaultPrefix;
  const eventBody = prefix && !note.startsWith(prefix) ? `${prefix} ${note}` : note;

  const nowIso = new Date().toISOString();
  const patch: Parameters<typeof updateOutreachProspect>[2] = {
    lastContactedAt: nowIso,
  };

  // If this is an outbound/interactive touchpoint and prospect hasn't been contacted yet,
  // advance them from 'not_contacted' to 'emailed' (contacted).
  if (prospect.status === "not_contacted" && input.channel !== "note") {
    patch.status = "emailed";
  }

  // If follow-up date is provided, update next_action_due_at and next_action_type
  if (input.nextActionDueAt) {
    patch.nextActionDueAt = new Date(input.nextActionDueAt).toISOString();
    patch.nextActionType = input.nextActionType ?? (input.channel === "call" ? "call" : "email_reminder");
  }

  await updateOutreachProspect(ADMIN_ACTOR, prospectId, patch);

  await logOutreachEvent(ADMIN_ACTOR, {
    prospectId,
    eventType: meta.underlyingEventType,
    body: eventBody,
  });

  revalidateOutreach(prospectId);
  return { message: `${meta.badgeLabel} logged.` };
}

export async function logOutreachTouchpointFormAction(
  prospectId: string,
  _prevState: OutreachActionResult,
  formData: FormData,
): Promise<OutreachActionResult> {
  const channel = (formData.get("channel") as OutreachChannel) || "whatsapp";
  const note = String(formData.get("note") ?? "").trim();
  const nextActionDueAt = String(formData.get("nextActionDueAt") ?? "").trim() || null;
  const nextActionType = (formData.get("nextActionType") as OutreachActionType) || null;

  return logOutreachTouchpointAction(prospectId, {
    channel,
    note,
    nextActionDueAt,
    nextActionType,
  });
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

export async function deleteOutreachProspectAction(
  prospectId: string,
): Promise<OutreachActionResult> {
  await requireAdminSession();
  const prospect = await getOutreachProspect(ADMIN_ACTOR, prospectId);
  if (!prospect) {
    return { error: "This prospect does not exist." };
  }

  try {
    await deleteOutreachProspect(ADMIN_ACTOR, prospectId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not delete this prospect." };
  }

  revalidateOutreach(prospectId);
  return { message: "Prospect deleted." };
}

