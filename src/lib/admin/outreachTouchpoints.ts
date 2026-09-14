// Outreach touchpoints & channels — parsing and presentation helpers for
// multi-channel affiliate outreach (WhatsApp, meeting proposals, phone calls,
// in-person visits, direct emails, and notes).
//
// Designed to layer cleanly over the existing `outreach_events` table (which
// enforces a check constraint: note, email_sent, call_logged, replied,
// declined, onboarded) and `outreach_prospects.last_contacted_at` by using
// human-readable bracket prefixes (e.g. `[WhatsApp] ...`, `[Meeting proposed] ...`)
// without requiring database schema changes.

import type { OutreachEventType } from "@/lib/data/outreach";

export type OutreachChannel =
  | "whatsapp"
  | "meeting_proposed"
  | "meeting_held"
  | "call"
  | "in_person"
  | "email"
  | "note"
  | "replied"
  | "declined"
  | "onboarded";

export interface ChannelMeta {
  channel: OutreachChannel;
  label: string;
  badgeLabel: string;
  iconName: "MessageSquare" | "Calendar" | "Users" | "Phone" | "MapPin" | "Mail" | "FileText" | "CheckCircle2" | "XCircle" | "Building2";
  toneClass: string;
  placeholder: string;
  defaultPrefix?: string;
  underlyingEventType: OutreachEventType;
}

export const LOGGABLE_CHANNELS: OutreachChannel[] = [
  "whatsapp",
  "meeting_proposed",
  "meeting_held",
  "call",
  "in_person",
  "email",
  "note",
];

export const CHANNEL_META: Record<OutreachChannel, ChannelMeta> = {
  whatsapp: {
    channel: "whatsapp",
    label: "WhatsApp",
    badgeLabel: "WhatsApp",
    iconName: "MessageSquare",
    toneClass: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    placeholder: "e.g. Sent voice note & app link on +34 6...",
    defaultPrefix: "[WhatsApp]",
    underlyingEventType: "note",
  },
  meeting_proposed: {
    channel: "meeting_proposed",
    label: "Meeting proposed",
    badgeLabel: "Meeting proposed",
    iconName: "Calendar",
    toneClass: "text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    placeholder: "e.g. Proposed 20-min demo call for Thursday at 14:00",
    defaultPrefix: "[Meeting proposed]",
    underlyingEventType: "note",
  },
  meeting_held: {
    channel: "meeting_held",
    label: "Meeting held",
    badgeLabel: "Meeting held",
    iconName: "Users",
    toneClass: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    placeholder: "e.g. Walked through guest app; interested in boat tour cards",
    defaultPrefix: "[Meeting held]",
    underlyingEventType: "note",
  },
  call: {
    channel: "call",
    label: "Phone call",
    badgeLabel: "Call",
    iconName: "Phone",
    toneClass: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    placeholder: "e.g. Left voicemail with reception; follow up Friday",
    defaultPrefix: "[Call]",
    underlyingEventType: "call_logged",
  },
  in_person: {
    channel: "in_person",
    label: "In person",
    badgeLabel: "In person",
    iconName: "MapPin",
    toneClass: "text-orange-700 bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    placeholder: "e.g. Visited dock kiosk, spoke with captain Marco",
    defaultPrefix: "[In person]",
    underlyingEventType: "note",
  },
  email: {
    channel: "email",
    label: "Email",
    badgeLabel: "Email sent",
    iconName: "Mail",
    toneClass: "text-sky-700 bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    placeholder: "e.g. Sent custom deck directly from personal inbox",
    defaultPrefix: "[Email]",
    underlyingEventType: "email_sent",
  },
  note: {
    channel: "note",
    label: "General note",
    badgeLabel: "Note",
    iconName: "FileText",
    toneClass: "text-[var(--admin-ink-soft)] bg-[var(--admin-border)]/50 border-[var(--admin-border)]",
    placeholder: "e.g. Best reached in the morning; active on Instagram",
    underlyingEventType: "note",
  },
  replied: {
    channel: "replied",
    label: "Replied",
    badgeLabel: "Replied",
    iconName: "CheckCircle2",
    toneClass: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    placeholder: "",
    underlyingEventType: "replied",
  },
  declined: {
    channel: "declined",
    label: "Declined",
    badgeLabel: "Declined",
    iconName: "XCircle",
    toneClass: "text-zinc-600 bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    placeholder: "",
    underlyingEventType: "declined",
  },
  onboarded: {
    channel: "onboarded",
    label: "Onboarded",
    badgeLabel: "Onboarded",
    iconName: "Building2",
    toneClass: "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    placeholder: "",
    underlyingEventType: "onboarded",
  },
};

export interface ParsedOutreachEvent {
  channel: OutreachChannel;
  meta: ChannelMeta;
  cleanBody: string;
  rawBody: string | null;
  createdAt: string;
}

const PREFIX_REGEX = /^\[(whatsapp|meeting proposed|meeting held|in person|in-person|call|email|note|replied|replied via email)\]\s*/i;

/**
 * Parses an outreach event's raw body and event_type into structured channel
 * metadata and clean content text (with bracket prefixes stripped).
 */
export function parseOutreachEvent(event: {
  eventType: OutreachEventType;
  body: string | null;
  createdAt: string;
}): ParsedOutreachEvent {
  const rawBody = event.body ?? "";
  const match = rawBody.match(PREFIX_REGEX);

  let channel: OutreachChannel;
  let cleanBody = rawBody;

  if (match) {
    const rawTag = match[1].toLowerCase();
    cleanBody = rawBody.slice(match[0].length).trim();
    switch (rawTag) {
      case "whatsapp":
        channel = "whatsapp";
        break;
      case "meeting proposed":
        channel = "meeting_proposed";
        break;
      case "meeting held":
        channel = "meeting_held";
        break;
      case "in person":
      case "in-person":
        channel = "in_person";
        break;
      case "call":
        channel = "call";
        break;
      case "email":
        channel = "email";
        break;
      case "replied":
      case "replied via email":
        channel = "replied";
        break;
      case "note":
      default:
        channel = "note";
        break;
    }
  } else {
    switch (event.eventType) {
      case "email_sent":
        channel = "email";
        break;
      case "call_logged":
        channel = "call";
        break;
      case "replied":
        channel = "replied";
        break;
      case "declined":
        channel = "declined";
        break;
      case "onboarded":
        channel = "onboarded";
        break;
      case "note":
      default:
        channel = "note";
        break;
    }
  }

  const meta = CHANNEL_META[channel] ?? CHANNEL_META.note;
  return {
    channel,
    meta,
    cleanBody: cleanBody || rawBody,
    rawBody: event.body,
    createdAt: event.createdAt,
  };
}

/**
 * Formats a relative timestamp concisely for table columns and header badges
 * (e.g. "Today", "Yesterday", "3d ago", "12 Sep").
 */
export function formatRelativeDate(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const time = date.getTime();
  if (Number.isNaN(time)) return "";

  const diffMs = now - time;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24 && new Date(now).toDateString() === date.toDateString()) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) {
    return "Yesterday";
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0 && diffDays < 7) {
    return `${diffDays}d ago`;
  }

  const isCurrentYear = new Date(now).getFullYear() === date.getFullYear();
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });
}

export interface LastContactSummary {
  channel: OutreachChannel;
  label: string;
  relativeTime: string;
  badgeClass: string;
  snippet: string | null;
  text: string;
  isMeetingProposed: boolean;
}

/**
 * Derives the most recent contact touchpoint and human summary for a prospect.
 * Prefers actual outreach touchpoints over passive internal notes.
 */
export function formatLastContact(
  lastContactedAt: string | null,
  events: Array<{ eventType: OutreachEventType; body: string | null; createdAt: string }> = [],
  now: number = Date.now(),
): LastContactSummary | null {
  if (events.length > 0) {
    const parsed = events.map(parseOutreachEvent);

    const contactEvent = parsed.find(
      (e) =>
        e.channel === "whatsapp" ||
        e.channel === "meeting_proposed" ||
        e.channel === "meeting_held" ||
        e.channel === "call" ||
        e.channel === "in_person" ||
        e.channel === "email" ||
        e.channel === "replied",
    ) ?? parsed[0];

    if (contactEvent) {
      const relTime = formatRelativeDate(contactEvent.createdAt, now);
      const isMeetingProposed = contactEvent.channel === "meeting_proposed";
      const snippet = contactEvent.cleanBody
        ? contactEvent.cleanBody.length > 60
          ? `${contactEvent.cleanBody.slice(0, 57)}…`
          : contactEvent.cleanBody
        : null;

      const text = `${contactEvent.meta.badgeLabel} (${relTime})`;

      return {
        channel: contactEvent.channel,
        label: contactEvent.meta.badgeLabel,
        relativeTime: relTime,
        badgeClass: contactEvent.meta.toneClass,
        snippet,
        text,
        isMeetingProposed,
      };
    }
  }

  if (lastContactedAt) {
    const relTime = formatRelativeDate(lastContactedAt, now);
    return {
      channel: "email",
      label: "Contacted",
      relativeTime: relTime,
      badgeClass: CHANNEL_META.email.toneClass,
      snippet: null,
      text: `Contacted (${relTime})`,
      isMeetingProposed: false,
    };
  }

  return null;
}
