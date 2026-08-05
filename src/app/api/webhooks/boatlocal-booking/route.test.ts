import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { signWebhookBody, TIMESTAMP_HEADER, SIGNATURE_HEADER } from "@/lib/attributionWebhook";
import { recordClick, dangerouslyResetStore } from "@/lib/attributionStore";

const SECRET = "route-test-secret";

function signedRequest(bodyObj: unknown, opts: { secret?: string; timestamp?: number } = {}) {
  const body = JSON.stringify(bodyObj);
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = signWebhookBody(body, opts.secret ?? SECRET, timestamp);
  return new Request("http://localhost/api/webhooks/boatlocal-booking", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [TIMESTAMP_HEADER]: String(timestamp),
      [SIGNATURE_HEADER]: signature,
    },
    body,
  });
}

const validPayload = {
  event: "booking.confirmed",
  click_id: "bkl_known",
  booking_id: "BL-1",
  tour_id: "sunset-canal",
  guests: 2,
  amount_cents: 5600,
  currency: "EUR",
  booked_at: "2026-08-20T18:00:00Z",
};

describe("POST /api/webhooks/boatlocal-booking", () => {
  beforeEach(() => {
    dangerouslyResetStore();
    process.env.BOATLOCAL_WEBHOOK_SECRET = SECRET;
    recordClick({ clickId: "bkl_known", tourId: "sunset-canal" });
  });

  it("accepts a correctly signed, known-click payload and attributes it", async () => {
    const res = await POST(signedRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, deduplicated: false, attributed: true });
  });

  it("still acknowledges a booking whose click id we don't recognise", async () => {
    // Must not cause BoatLocal's side to retry forever just because our
    // click record aged out or never existed.
    const res = await POST(
      signedRequest({ ...validPayload, click_id: "bkl_unknown" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, deduplicated: false, attributed: false });
  });

  it("is idempotent on booking_id — a retried delivery doesn't double-record", async () => {
    const first = await POST(signedRequest(validPayload));
    const second = await POST(signedRequest(validPayload));

    expect((await first.json()).deduplicated).toBe(false);
    expect((await second.json()).deduplicated).toBe(true);
  });

  it("rejects a request signed with the wrong secret", async () => {
    const res = await POST(signedRequest(validPayload, { secret: "wrong" }));
    expect(res.status).toBe(401);
    expect((await res.json()).ok).toBe(false);
  });

  it("rejects a stale timestamp", async () => {
    const res = await POST(
      signedRequest(validPayload, { timestamp: Math.floor(Date.now() / 1000) - 10_000 }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a malformed payload with 400, not 401", async () => {
    const res = await POST(signedRequest({ nonsense: true }));
    expect(res.status).toBe(400);
  });

  it("refuses every request when the webhook secret isn't configured", async () => {
    delete process.env.BOATLOCAL_WEBHOOK_SECRET;
    const res = await POST(signedRequest(validPayload));
    expect(res.status).toBe(500);
  });
});
