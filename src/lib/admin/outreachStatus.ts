export type OutreachStatus = "not_contacted" | "emailed" | "replied" | "declined" | "onboarded";

export const OUTREACH_STATUSES: readonly OutreachStatus[] = [
  "not_contacted",
  "emailed",
  "replied",
  "declined",
  "onboarded",
] as const;

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  not_contacted: "Not contacted",
  emailed: "Emailed",
  replied: "Replied",
  declined: "Declined",
  onboarded: "Onboarded",
};

export const OUTREACH_STATUS_TONES: Record<OutreachStatus, "positive" | "neutral" | "warning"> = {
  not_contacted: "neutral",
  emailed: "neutral",
  replied: "positive",
  declined: "warning",
  onboarded: "positive",
};
