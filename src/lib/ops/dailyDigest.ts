import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface DigestEvent {
  id: string;
  eventType: string;
  body: string | null;
  createdAt: string;
}

export interface DigestProspectActivity {
  prospectId: string;
  name: string;
  contactName: string | null;
  status: string;
  nextActionType: string | null;
  nextActionDueAt: string | null;
  events: DigestEvent[];
}

export interface DigestCompanyChange {
  id: string;
  name: string;
  customDomain: string | null;
  reviewPlatform: string | null;
  updatedAt: string;
}

export interface DailyOpsDigestData {
  dateLabel: string;
  prospectActivities: DigestProspectActivity[];
  companyChanges: DigestCompanyChange[];
}

/**
 * Computes the start of the current day (midnight) in Europe/Amsterdam as a Date.
 */
export function getStartOfDayAmsterdam(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  const amsterdamMidnightString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`;
  const guessDate = new Date(amsterdamMidnightString + "Z");
  const tzOffsetMinutes = getTimezoneOffsetMinutes("Europe/Amsterdam", guessDate);
  const localMidnightUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - tzOffsetMinutes * 60 * 1000;
  return new Date(localMidnightUtcMs);
}

function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
}

/**
 * Summarizes the events for a given prospect into a concise, readable line for Slack.
 */
export function summarizeProspectEvents(activity: DigestProspectActivity): {
  typeSummary: string;
  highlight: string;
} {
  const { events, nextActionType, nextActionDueAt } = activity;
  const types = events.map((e) => e.eventType);
  const typeCounts = new Map<string, number>();
  for (const t of types) {
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }

  const parts: string[] = [];
  if (typeCounts.get("note")) parts.push(`${typeCounts.get("note")} note${typeCounts.get("note")! > 1 ? "s" : ""}`);
  if (typeCounts.get("call_logged")) parts.push(`${typeCounts.get("call_logged")} call${typeCounts.get("call_logged")! > 1 ? "s" : ""}`);
  if (typeCounts.get("email_sent")) parts.push(`${typeCounts.get("email_sent")} email${typeCounts.get("email_sent")! > 1 ? "s" : ""}`);
  if (typeCounts.get("replied")) parts.push("reply received");
  if (typeCounts.get("onboarded")) parts.push("onboarded");

  const typeSummary = `${events.length} touchpoint${events.length > 1 ? "s" : ""} (${parts.join(", ") || "activity"})`;

  // Look for key highlights in event bodies
  const noteBodies = events.map((e) => e.body || "").filter(Boolean);
  const hasMeeting = noteBodies.some((b) => /meeting/i.test(b));
  const hasVoicemail = noteBodies.some((b) => /voicemail|didn'?t pick up|no answer/i.test(b));
  const hasEnthusiastic = noteBodies.some((b) => /enthousiast|enthusiastic/i.test(b));

  const highlights: string[] = [];
  if (hasMeeting) {
    highlights.push("*Meeting set / discussed*");
  } else if (hasEnthusiastic) {
    highlights.push("Spoke with contact; positive reception");
  } else if (hasVoicemail) {
    highlights.push("Call placed (voicemail / unanswered)");
  } else if (typeCounts.get("email_sent")) {
    highlights.push("Outreach / proposal email sent");
  } else if (noteBodies.length > 0) {
    const cleanFirst = noteBodies[0].replace(/^\[.*?\]\s*/, "").slice(0, 80);
    highlights.push(cleanFirst);
  }

  if (nextActionType && nextActionDueAt) {
    const formattedDue = new Date(nextActionDueAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    const actionLabel = nextActionType === "call" ? "Follow-up call" : "Reminder";
    highlights.push(`${actionLabel} due ${formattedDue}`);
  }

  return {
    typeSummary,
    highlight: highlights.join(". ") || "Activity updated",
  };
}

/**
 * Formats a DailyOpsDigestData structure into a Slack-compatible markdown message.
 */
export function formatDailyOpsDigestSlackMessage(data: DailyOpsDigestData): string {
  const sections: string[] = [
    `:clipboard: *Daily Operations & Partner Outreach Digest — ${data.dateLabel}*`,
  ];

  if (data.prospectActivities.length === 0 && data.companyChanges.length === 0) {
    sections.push("_No partner outreach logs or tenant profile changes recorded today._");
    return sections.join("\n\n");
  }

  if (data.prospectActivities.length > 0) {
    const lines = [":handshake: *Partner Outreach & Activity Logged Today*"];
    for (const prospect of data.prospectActivities) {
      const contactPart = prospect.contactName ? ` (${prospect.contactName})` : "";
      const { typeSummary, highlight } = summarizeProspectEvents(prospect);
      lines.push(`• *${prospect.name}*${contactPart}`);
      lines.push(`  ↳ _${typeSummary}_: ${highlight}`);
    }
    sections.push(lines.join("\n"));
  }

  if (data.companyChanges.length > 0) {
    const lines = [":gear: *Tenant & Platform Changes Today*"];
    for (const company of data.companyChanges) {
      const details: string[] = [];
      if (company.customDomain) details.push(`custom domain: \`${company.customDomain}\``);
      if (company.reviewPlatform) details.push(`review platform: \`${company.reviewPlatform}\``);
      if (details.length === 0) details.push("branding / profile updated");
      lines.push(`• *${company.name}*`);
      lines.push(`  ↳ ${details.join(", ")}`);
    }
    sections.push(lines.join("\n"));
  }

  // Prioritized Next Actions
  const upcomingCallsOrMeetings = data.prospectActivities
    .filter((p) => p.nextActionType || p.events.some((e) => /meeting/i.test(e.body || "")))
    .slice(0, 3);

  if (upcomingCallsOrMeetings.length > 0) {
    const actionLines = [":dart: *Immediate Priorities / Next Actions*"];
    let idx = 1;
    for (const p of upcomingCallsOrMeetings) {
      const isMeeting = p.events.some((e) => /meeting/i.test(e.body || ""));
      if (isMeeting) {
        actionLines.push(`${idx++}. Prepare demo / onboarding for *${p.name}*`);
      } else if (p.nextActionType === "call") {
        actionLines.push(`${idx++}. Chasing call for *${p.name}*`);
      } else {
        actionLines.push(`${idx++}. Follow up on email with *${p.name}*`);
      }
    }
    sections.push(actionLines.join("\n"));
  }

  return sections.join("\n\n");
}

/**
 * Queries Supabase using the service-role client for all outreach events and company changes
 * that occurred since `since` (defaults to today's start in Amsterdam).
 */
export async function getDailyOpsDigestData(options?: {
  since?: Date;
  now?: Date;
}): Promise<DailyOpsDigestData> {
  const supabase = createAdminClient();
  const now = options?.now || new Date();
  const since = options?.since || getStartOfDayAmsterdam(now);
  const sinceIso = since.toISOString();

  // 1. Fetch outreach events with their prospect info
  const { data: eventsData, error: eventsError } = await supabase
    .from("outreach_events")
    .select(`
      id,
      prospect_id,
      event_type,
      body,
      created_at,
      outreach_prospects (
        id,
        name,
        contact_name,
        status,
        next_action_type,
        next_action_due_at
      )
    `)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });

  if (eventsError) throw eventsError;

  // Group events by prospect
  const prospectMap = new Map<string, DigestProspectActivity>();
  for (const raw of (eventsData || [])) {
    const p = (raw as any).outreach_prospects;
    if (!p) continue;
    if (!prospectMap.has(p.id)) {
      prospectMap.set(p.id, {
        prospectId: p.id,
        name: p.name,
        contactName: p.contact_name,
        status: p.status,
        nextActionType: p.next_action_type,
        nextActionDueAt: p.next_action_due_at,
        events: [],
      });
    }
    prospectMap.get(p.id)!.events.push({
      id: raw.id,
      eventType: raw.event_type,
      body: raw.body,
      createdAt: raw.created_at,
    });
  }

  // 2. Fetch updated companies
  const { data: companiesData, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, custom_domain, review_platform, updated_at")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false });

  if (companiesError) throw companiesError;

  const dateLabel = now.toLocaleDateString("en-US", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return {
    dateLabel,
    prospectActivities: Array.from(prospectMap.values()),
    companyChanges: (companiesData || []).map((c) => ({
      id: c.id,
      name: c.name,
      customDomain: c.custom_domain,
      reviewPlatform: c.review_platform,
      updatedAt: c.updated_at,
    })),
  };
}
