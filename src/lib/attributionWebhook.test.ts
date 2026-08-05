import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOLERANCE_SECONDS,
  signWebhookBody,
  verifyWebhookSignature,
} from "./attributionWebhook";

const SECRET = "test-secret-do-not-use-in-real-life";
const BODY = JSON.stringify({ event: "booking.confirmed", click_id: "bkl_abc" });

describe("signWebhookBody / verifyWebhookSignature round trip", () => {
  it("accepts a signature it just produced", () => {
    const nowSeconds = 1_800_000_000;
    const signature = signWebhookBody(BODY, SECRET, nowSeconds);

    const result = verifyWebhookSignature({
      rawBody: BODY,
      signatureHeader: signature,
      timestampHeader: String(nowSeconds),
      secret: SECRET,
      now: () => nowSeconds * 1000,
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects a signature produced with the wrong secret", () => {
    const nowSeconds = 1_800_000_000;
    const signature = signWebhookBody(BODY, "wrong-secret", nowSeconds);

    const result = verifyWebhookSignature({
      rawBody: BODY,
      signatureHeader: signature,
      timestampHeader: String(nowSeconds),
      secret: SECRET,
      now: () => nowSeconds * 1000,
    });

    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects if even one byte of the body changed after signing", () => {
    const nowSeconds = 1_800_000_000;
    const signature = signWebhookBody(BODY, SECRET, nowSeconds);
    const tamperedBody = BODY.replace("confirmed", "cancelled");

    const result = verifyWebhookSignature({
      rawBody: tamperedBody,
      signatureHeader: signature,
      timestampHeader: String(nowSeconds),
      secret: SECRET,
      now: () => nowSeconds * 1000,
    });

    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a request older than the tolerance window (replay protection)", () => {
    const signedAt = 1_800_000_000;
    const signature = signWebhookBody(BODY, SECRET, signedAt);
    const receivedAt = signedAt + DEFAULT_TOLERANCE_SECONDS + 1;

    const result = verifyWebhookSignature({
      rawBody: BODY,
      signatureHeader: signature,
      timestampHeader: String(signedAt),
      secret: SECRET,
      now: () => receivedAt * 1000,
    });

    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("accepts a request right at the edge of the tolerance window", () => {
    const signedAt = 1_800_000_000;
    const signature = signWebhookBody(BODY, SECRET, signedAt);
    const receivedAt = signedAt + DEFAULT_TOLERANCE_SECONDS - 1;

    const result = verifyWebhookSignature({
      rawBody: BODY,
      signatureHeader: signature,
      timestampHeader: String(signedAt),
      secret: SECRET,
      now: () => receivedAt * 1000,
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects a request from the future beyond tolerance too (clock skew is symmetric)", () => {
    const signedAt = 1_800_000_000;
    const signature = signWebhookBody(BODY, SECRET, signedAt);
    const receivedAt = signedAt - DEFAULT_TOLERANCE_SECONDS - 1;

    const result = verifyWebhookSignature({
      rawBody: BODY,
      signatureHeader: signature,
      timestampHeader: String(signedAt),
      secret: SECRET,
      now: () => receivedAt * 1000,
    });

    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("reports missing-headers distinctly from a bad signature", () => {
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: null,
        timestampHeader: "1800000000",
        secret: SECRET,
      }),
    ).toEqual({ ok: false, reason: "missing-headers" });

    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: "sha256=deadbeef",
        timestampHeader: null,
        secret: SECRET,
      }),
    ).toEqual({ ok: false, reason: "missing-headers" });
  });

  it("reports a non-numeric timestamp distinctly from a stale one", () => {
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: "sha256=deadbeef",
        timestampHeader: "not-a-number",
        secret: SECRET,
      }),
    ).toEqual({ ok: false, reason: "bad-timestamp" });
  });

  it("does not throw when the signature header has a different length than expected", () => {
    // timingSafeEqual throws on mismatched buffer lengths if called directly;
    // the length check must happen before it, not be skipped.
    const nowSeconds = 1_800_000_000;
    expect(() =>
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: "sha256=short",
        timestampHeader: String(nowSeconds),
        secret: SECRET,
        now: () => nowSeconds * 1000,
      }),
    ).not.toThrow();
  });
});
