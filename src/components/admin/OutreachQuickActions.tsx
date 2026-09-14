"use client";

// Outreach detail page — quick action forms: logging touchpoints across
// WhatsApp, meeting proposals, calls, and in-person visits, updating pipeline
// status, and onboarding or closing out prospects.

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Users,
  XCircle,
} from "lucide-react";

import {
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/admin/primitives";
import {
  deleteOutreachProspectAction,
  logOutreachTouchpointFormAction,
  markOutreachDeclinedAction,
  markOutreachRepliedAction,
  onboardOutreachProspectAction,
  updateOutreachStatusFormAction,
  type OutreachActionResult,
} from "@/lib/admin/outreachActions";
import {
  OUTREACH_STATUSES,
  OUTREACH_STATUS_LABELS,
  type OutreachStatus,
} from "@/lib/admin/outreachStatus";
import {
  CHANNEL_META,
  LOGGABLE_CHANNELS,
  type OutreachChannel,
} from "@/lib/admin/outreachTouchpoints";
import type { OutreachActionType } from "@/lib/data/outreach";

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

function ChannelIcon({ name, className = "h-3.5 w-3.5" }: { name: string; className?: string }) {
  switch (name) {
    case "MessageSquare":
      return <MessageSquare className={className} />;
    case "Calendar":
      return <Calendar className={className} />;
    case "Users":
      return <Users className={className} />;
    case "Phone":
      return <Phone className={className} />;
    case "MapPin":
      return <MapPin className={className} />;
    case "Mail":
      return <Mail className={className} />;
    case "CheckCircle2":
      return <CheckCircle2 className={className} />;
    case "XCircle":
      return <XCircle className={className} />;
    case "Building2":
      return <Building2 className={className} />;
    case "FileText":
    default:
      return <FileText className={className} />;
  }
}

function LogTouchpointForm({ prospectId }: { prospectId: string }) {
  const [selectedChannel, setSelectedChannel] = useState<OutreachChannel>("whatsapp");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [customDate, setCustomDate] = useState<string>("");
  const [actionType, setActionType] = useState<OutreachActionType>("call");

  const [state, formAction, pending] = useActionState(
    logOutreachTouchpointFormAction.bind(null, prospectId),
    initialState,
  );

  const meta = CHANNEL_META[selectedChannel];

  let computedDueAt = "";
  if (followUpDays !== null) {
    const d = new Date();
    d.setDate(d.getDate() + followUpDays);
    computedDueAt = d.toISOString().split("T")[0];
  } else if (customDate) {
    computedDueAt = customDate;
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className={FIELD_LABEL_CLASS}>Log touchpoint</label>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {LOGGABLE_CHANNELS.map((ch) => {
            const m = CHANNEL_META[ch];
            const isSelected = selectedChannel === ch;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => {
                  setSelectedChannel(ch);
                  if (ch === "meeting_proposed" && followUpDays === null && !customDate) {
                    setShowFollowUp(true);
                    setFollowUpDays(3);
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[var(--admin-ink)] text-white shadow-xs"
                    : "bg-[var(--admin-bg)] text-[var(--admin-ink-soft)] hover:bg-[var(--admin-border)]/60 hover:text-[var(--admin-ink)]"
                }`}
              >
                <ChannelIcon name={m.iconName} className="h-3 w-3" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <input type="hidden" name="channel" value={selectedChannel} />
      <input type="hidden" name="nextActionDueAt" value={computedDueAt} />
      <input type="hidden" name="nextActionType" value={actionType} />

      <div>
        <textarea
          name="note"
          required
          rows={2}
          placeholder={meta.placeholder}
          className={`mt-1 ${FIELD_CLASS}`}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowFollowUp(!showFollowUp)}
          className="text-xs text-[var(--admin-accent)] hover:underline cursor-pointer flex items-center gap-1 font-medium"
        >
          {showFollowUp ? "− Hide follow-up date" : "+ Schedule follow-up date"}
          {computedDueAt ? ` (${computedDueAt})` : ""}
        </button>
      </div>

      {showFollowUp ? (
        <div className="rounded-xl border border-[var(--admin-border)] p-2.5 space-y-2 bg-[var(--admin-bg)]/40">
          <span className="text-[11px] font-semibold text-[var(--admin-ink)] block">Follow-up due:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: "Tomorrow", days: 1 },
              { label: "In 3 days", days: 3 },
              { label: "In 1 week", days: 7 },
            ].map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => {
                  setFollowUpDays(preset.days);
                  setCustomDate("");
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium border cursor-pointer ${
                  followUpDays === preset.days
                    ? "border-[var(--admin-accent)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]"
                    : "border-[var(--admin-border)] text-[var(--admin-ink-soft)] hover:bg-[var(--admin-border)]/40"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setFollowUpDays(null);
              }}
              className="rounded-md border border-[var(--admin-border)] bg-white dark:bg-zinc-900 px-2 py-0.5 text-xs text-[var(--admin-ink)]"
            />
          </div>

          <div className="flex items-center gap-3 pt-1 text-xs">
            <span className="text-[var(--admin-ink-soft)]">Type:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="_actionTypeRadio"
                checked={actionType === "call"}
                onChange={() => setActionType("call")}
              />
              <span>Call</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="_actionTypeRadio"
                checked={actionType === "email_reminder"}
                onChange={() => setActionType("email_reminder")}
              />
              <span>Email reminder</span>
            </label>
          </div>
        </div>
      ) : null}

      <button type="submit" disabled={pending} className={`w-full ${GHOST_BUTTON_CLASS}`}>
        {pending ? "Logging…" : `Log ${meta.label.toLowerCase()}`}
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
      ? "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
      : "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--admin-border)] px-4 py-2.5 text-sm font-medium text-[var(--admin-ink-soft)] transition-colors hover:bg-[var(--admin-bg)] disabled:opacity-50 cursor-pointer";

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
      <button type="button" onClick={() => setOpen(true)} className={`w-full ${PRIMARY_BUTTON_CLASS} cursor-pointer`}>
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
        <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON_CLASS} cursor-pointer`}>
          {pending ? "Onboarding…" : "Confirm — onboard"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-[var(--admin-ink-soft)] cursor-pointer">
          Cancel
        </button>
      </div>
      <ResultLine state={state} />
    </form>
  );
}

function UpdateStatusForm({
  prospectId,
  currentStatus,
}: {
  prospectId: string;
  currentStatus: OutreachStatus;
}) {
  const [state, formAction, pending] = useActionState(
    updateOutreachStatusFormAction.bind(null, prospectId),
    initialState,
  );

  return (
    <form action={formAction}>
      <label className={FIELD_LABEL_CLASS}>
        Change status
        <select
          name="status"
          defaultValue={currentStatus}
          className={`mt-1.5 ${FIELD_CLASS}`}
        >
          {OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {OUTREACH_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className={`mt-2 block ${FIELD_LABEL_CLASS}`}>
        Note
        <input
          name="note"
          type="text"
          placeholder="Optional reason or context"
          className={`mt-1.5 ${FIELD_CLASS}`}
        />
      </label>
      <button type="submit" disabled={pending} className={`mt-2 ${GHOST_BUTTON_CLASS} cursor-pointer`}>
        {pending ? "Updating…" : "Update status"}
      </button>
      <ResultLine state={state} />
    </form>
  );
}

export interface OutreachQuickActionsProps {
  prospectId: string;
  status: OutreachStatus;
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
        <LogTouchpointForm prospectId={prospectId} />
      </div>

      <div className="border-t border-[var(--admin-border)] pt-4">
        <UpdateStatusForm prospectId={prospectId} currentStatus={status} />
      </div>

      <div className="border-t border-[var(--admin-border)] pt-4 flex justify-end">
        <DeleteProspectForm prospectId={prospectId} />
      </div>
    </div>
  );
}

function DeleteProspectForm({ prospectId }: { prospectId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await deleteOutreachProspectAction(prospectId);
      if (res.error) {
        setError(res.error);
        setPending(false);
      } else {
        router.push("/admin/outreach");
      }
    } catch {
      setError("Failed to delete prospect.");
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-600 hover:text-red-700 hover:underline cursor-pointer"
      >
        Delete prospect…
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs dark:border-red-900/40 dark:bg-red-950/20">
      <p className="font-semibold text-red-900 dark:text-red-300">
        Permanently delete this prospect?
      </p>
      <p className="mt-1 text-red-700 dark:text-red-400">
        This removes the prospect and all timeline history permanently.
      </p>
      {error ? <p className="mt-1.5 font-medium text-red-600">{error}</p> : null}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="rounded-lg px-2.5 py-1.5 text-[var(--admin-ink-soft)] hover:bg-[var(--admin-border)]/40 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

