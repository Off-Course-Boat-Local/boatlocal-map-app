// Turns a recommendation's `hours` free text into a single "relative to
// right now" status line for the guest app — founder request, 2026-09-01:
// "I don't need to see the whole week's calendar... say closing soon, or
// opening in x hours, or closing in x hours minutes."
//
// `hours` is guide-entered free text OR pulled verbatim from Google Places
// (src/lib/admin/googlePlaces.ts's getPlaceDetails: regularOpeningHours.
// weekdayDescriptions.join("; ")) — there is no structured schedule
// anywhere in the data model, on purpose (guides write whatever's true for
// their place, e.g. "Tue–Sun 11:00–18:00, closed Mondays" or "Always
// open", not a fixed format). Only the Google-sourced shape — exactly
// seven "DayName: H:MM AM/PM – H:MM AM/PM" (or "DayName: Closed")
// segments joined by "; " — is structured enough to compute a relative
// status from. Anything else (including that "Always open" style free
// text) falls back to being shown unchanged, same as before this existed.

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export interface DaySchedule {
  /** 0 = Sunday .. 6 = Saturday, matching Date.getDay(). */
  day: number;
  closed: boolean;
  /** Minutes since midnight. */
  openMinutes: number;
  /**
   * Minutes since midnight — may exceed 1440 when the close time is past
   * midnight (e.g. open 20:00, close 01:00 -> closeMinutes = 25*60), so a
   * span can be compared without day-boundary arithmetic at the call site.
   */
  closeMinutes: number;
}

function parseClockTime(raw: string): number | null {
  // The AM/PM marker is optional: Google's own weekdayDescriptions
  // sometimes render noon as a bare "12:00" with no suffix (seen live on
  // "Museum of the Canals" — "Monday: 12:00 – 5:00 PM"), not just in
  // guide-entered free text. A bare 12 is always noon in that shape (a
  // bare midnight would read "12:00 AM" explicitly, as every other
  // Google-sourced string in this app does) — any other bare hour is
  // genuinely ambiguous, so it's left unparsed rather than guessed at.
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  const meridiem = m[3]?.toUpperCase();
  if (!meridiem && hour !== 12) return null;
  const isPM = meridiem ? meridiem === "PM" : true;
  if (hour === 12) hour = 0;
  if (isPM) hour += 12;
  return hour * 60 + minute;
}

/**
 * Parses the Google-style "DayName: open – close; DayName: open – close; ..."
 * shape into exactly seven day entries. Returns null for anything else —
 * callers must fall back to showing the raw text unchanged in that case.
 */
export function parseWeeklyHours(text: string): DaySchedule[] | null {
  const segments = text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length !== 7) return null;

  const byDay = new Map<number, DaySchedule>();

  for (const segment of segments) {
    const dayMatch = segment.match(/^([A-Za-z]+):\s*(.+)$/);
    if (!dayMatch) return null;

    const dayIndex = DAY_NAMES.indexOf(dayMatch[1].toLowerCase());
    if (dayIndex === -1) return null;

    const rest = dayMatch[2].trim();
    if (/^closed$/i.test(rest)) {
      byDay.set(dayIndex, { day: dayIndex, closed: true, openMinutes: 0, closeMinutes: 0 });
      continue;
    }

    // Google's dash is an en dash (–); tolerate a plain hyphen too.
    const rangeMatch = rest.match(/^(.+?)\s*[–-]\s*(.+)$/);
    if (!rangeMatch) return null;

    const open = parseClockTime(rangeMatch[1]);
    const closeRaw = parseClockTime(rangeMatch[2]);
    if (open === null || closeRaw === null) return null;

    // Close time <= open time means the span crosses midnight.
    const close = closeRaw <= open ? closeRaw + 24 * 60 : closeRaw;
    byDay.set(dayIndex, { day: dayIndex, closed: false, openMinutes: open, closeMinutes: close });
  }

  if (byDay.size !== 7) return null;
  return DAY_NAMES.map((_, i) => byDay.get(i)!);
}

export type HoursStatus =
  | { kind: "open-closing-soon" }
  | { kind: "open-closes-in"; minutes: number }
  | { kind: "closed-opening-soon" }
  | { kind: "closed-opens-in"; minutes: number }
  | { kind: "unknown" };

/** Under this many minutes, say "closing/opening soon" instead of a duration. */
const SOON_THRESHOLD_MINUTES = 30;

/**
 * Where a 7-day schedule and "now" leave a place: open and about to close,
 * open with time to spare, closed and about to open, or closed with a
 * later opening this week. Checks yesterday's entry too, since an overnight
 * span (e.g. Friday 20:00–01:00) is "open" for the first hour of Saturday
 * even though Saturday's own entry hasn't started yet.
 */
export function computeHoursStatus(schedule: DaySchedule[], now: Date): HoursStatus {
  const byDay = new Map(schedule.map((d) => [d.day, d]));
  const todayIndex = now.getDay();
  const yesterdayIndex = (todayIndex + 6) % 7;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const yesterday = byDay.get(yesterdayIndex);
  if (yesterday && !yesterday.closed && yesterday.closeMinutes > 1440) {
    const closeMinutesToday = yesterday.closeMinutes - 1440;
    if (nowMinutes < closeMinutesToday) {
      const minutesUntilClose = closeMinutesToday - nowMinutes;
      return minutesUntilClose <= SOON_THRESHOLD_MINUTES
        ? { kind: "open-closing-soon" }
        : { kind: "open-closes-in", minutes: minutesUntilClose };
    }
  }

  const today = byDay.get(todayIndex);
  if (today && !today.closed) {
    if (nowMinutes >= today.openMinutes && nowMinutes < today.closeMinutes) {
      const minutesUntilClose = today.closeMinutes - nowMinutes;
      return minutesUntilClose <= SOON_THRESHOLD_MINUTES
        ? { kind: "open-closing-soon" }
        : { kind: "open-closes-in", minutes: minutesUntilClose };
    }
    if (nowMinutes < today.openMinutes) {
      const minutesUntilOpen = today.openMinutes - nowMinutes;
      return minutesUntilOpen <= SOON_THRESHOLD_MINUTES
        ? { kind: "closed-opening-soon" }
        : { kind: "closed-opens-in", minutes: minutesUntilOpen };
    }
  }

  // Closed for the rest of today (or today has no hours at all) — walk
  // forward to the next day this week that opens.
  for (let offset = 1; offset <= 7; offset++) {
    const entry = byDay.get((todayIndex + offset) % 7);
    if (entry && !entry.closed) {
      const minutesUntilOpen = offset * 1440 - nowMinutes + entry.openMinutes;
      return minutesUntilOpen <= SOON_THRESHOLD_MINUTES
        ? { kind: "closed-opening-soon" }
        : { kind: "closed-opens-in", minutes: minutesUntilOpen };
    }
  }

  // Every day is marked closed — genuinely never open.
  return { kind: "unknown" };
}

/** "45m", "2h", "2h 15m" — never "0h 0m" or a bare "0m". */
export function formatDuration(minutes: number): string {
  const wholeMinutes = Math.max(1, Math.round(minutes));
  const h = Math.floor(wholeMinutes / 60);
  const m = wholeMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function hoursStatusLabel(status: HoursStatus): string | null {
  switch (status.kind) {
    case "open-closing-soon":
      return "Closing soon";
    case "open-closes-in":
      return `Closes in ${formatDuration(status.minutes)}`;
    case "closed-opening-soon":
      return "Opening soon";
    case "closed-opens-in":
      return `Opens in ${formatDuration(status.minutes)}`;
    case "unknown":
      return null;
  }
}

/**
 * The single label a guest sees: a relative status for a parseable
 * Google-style weekly schedule, or the original text unchanged for
 * anything else (guide-entered free text, "Always open", etc.) — never
 * throws, always returns something displayable.
 */
export function relativeHoursLabel(hoursText: string, now: Date = new Date()): string {
  const trimmed = hoursText.trim();
  if (!trimmed) return trimmed;

  const schedule = parseWeeklyHours(trimmed);
  if (!schedule) return trimmed;

  const status = computeHoursStatus(schedule, now);
  return hoursStatusLabel(status) ?? trimmed;
}
