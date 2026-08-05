"use client";

// The QR a guest actually scans.
//
// Generated in-process with no third-party service and no per-code cost —
// PRD §13 requires PNG and SVG output for print (a card, a receipt, a room-key
// sleeve). This spike renders the on-screen version; the download variants are
// the same library.
//
// It encodes the page's own URL, so it is always correct — including the
// company subdomain and the guide path — rather than a value someone has to
// remember to update.

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export interface ShareQrProps {
  /** Defaults to the current page URL. */
  value?: string;
  size?: number;
  className?: string;
}

export default function ShareQr({ value, size = 148, className }: ShareQrProps) {
  const [qr, setQr] = useState<{ dataUrl: string; encoded: string } | null>(
    null,
  );

  useEffect(() => {
    // `window.location.href` is only available on the client, so the target is
    // resolved here rather than during render — and both pieces of state land
    // in a single update so the caption can never describe a stale image.
    const target = value ?? window.location.href;
    let cancelled = false;

    QRCode.toDataURL(target, {
      width: size * 2, // 2x so it stays crisp on a retina screen and in print
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1F2430FF", light: "#FFFFFFFF" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQr({ dataUrl, encoded: target });
      })
      .catch(() => {
        // A QR we cannot draw is not worth crashing the page over; the link
        // is still on screen and still copyable.
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div className={className}>
      <div
        className="flex items-center justify-center rounded-xl bg-white p-2 shadow-sm"
        style={{ width: size, height: size }}
      >
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr.dataUrl}
            alt={`QR code linking to ${qr.encoded}`}
            width={size - 16}
            height={size - 16}
          />
        ) : null}
      </div>
      <p className="mt-2 break-all text-[10px] leading-tight text-neutral-500">
        {qr?.encoded ?? ""}
      </p>
    </div>
  );
}
