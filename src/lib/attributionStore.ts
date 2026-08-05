// DEV-ONLY in-memory store for the attribution round trip.
//
// There is no live database yet (see docs/attribution.md). This lets the
// full click -> boatlocal.nl -> webhook -> attributed booking flow be
// demoed and tested with dummy data today. It is a module-level Map:
// resets on every server restart or hot-reload, is not shared across
// server instances, and must NOT be mistaken for real persistence.
//
// TODO: once the schema exists (supabase/migrations/), replace both
// functions' bodies with real queries against the Event table and delete
// this file. The call sites (the booking-URL builder and the webhook route)
// are written against this same shape so that swap should not require
// touching them.

export interface RecordedClick {
  clickId: string;
  tourId: string;
  companySlug?: string;
  guideSlug?: string;
  date?: string;
  guests?: number;
  createdAt: string;
}

export interface RecordedBooking {
  bookingId: string;
  clickId: string;
  event: "booking.confirmed" | "booking.cancelled";
  tourId: string;
  guests: number;
  amountCents: number;
  currency: string;
  bookedAt: string;
  receivedAt: string;
}

const clicksByClickId = new Map<string, RecordedClick>();
const bookingsByBookingId = new Map<string, RecordedBooking>();

export function recordClick(click: Omit<RecordedClick, "createdAt">): RecordedClick {
  const record: RecordedClick = { ...click, createdAt: new Date().toISOString() };
  clicksByClickId.set(click.clickId, record);
  return record;
}

export function getClick(clickId: string): RecordedClick | null {
  return clicksByClickId.get(clickId) ?? null;
}

/**
 * Returns `{ inserted: false }` on a duplicate delivery rather than throwing
 * — webhook senders retry on anything that isn't a fast 2xx, and a retry of
 * an already-processed booking must be a no-op, not a double count.
 */
export function recordBooking(
  booking: Omit<RecordedBooking, "receivedAt">,
): { inserted: boolean; record: RecordedBooking } {
  const existing = bookingsByBookingId.get(booking.bookingId);
  if (existing) {
    return { inserted: false, record: existing };
  }
  const record: RecordedBooking = { ...booking, receivedAt: new Date().toISOString() };
  bookingsByBookingId.set(booking.bookingId, record);
  return { inserted: true, record };
}

/** For the preview endpoint / tests — not meant for production use. */
export function dangerouslyGetAllRecords() {
  return {
    clicks: Array.from(clicksByClickId.values()),
    bookings: Array.from(bookingsByBookingId.values()),
  };
}

/** Tests need a clean slate between cases; nothing else should call this. */
export function dangerouslyResetStore() {
  clicksByClickId.clear();
  bookingsByBookingId.clear();
}
