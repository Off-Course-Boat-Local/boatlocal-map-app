"use client";

// The QR a guest actually scans.
//
// Generated in-process with no third-party service and no per-code cost —
// PRD §13 requires PNG and SVG output for print (a card, a receipt, a room-key
// sleeve). The on-screen render is always PNG (crisper at small sizes in a
// browser); pass `downloadFileName` to additionally offer PNG *and* SVG
// downloads — same "qrcode" package, `toDataURL` and
// `toString({ type: "svg" })` respectively. Left off by default so the
// guest-facing usages (the Welcome screen's "share with a travel companion",
// the (guest) layout header) keep their current compact look; Studio's
// Guides list, company QR, and a guide's own Link & QR page pass it.
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
  /**
   * When set, renders "PNG" / "SVG" download buttons under the QR, and doubles
   * as the downloaded file's name (without extension). Omit to keep the
   * on-screen-only PNG this component has always rendered.
   */
  downloadFileName?: string;
}

const QR_COLOR = { dark: "#1F2430FF", light: "#FFFFFFFF" };

export default function ShareQr({ value, size = 148, className, downloadFileName }: ShareQrProps) {
  const [qr, setQr] = useState<{ dataUrl: string; encoded: string; svg: string | null } | null>(
    null,
  );

  useEffect(() => {
    // `window.location.href` is only available on the client, so the target is
    // resolved here rather than during render — and every piece of state
    // lands in a single update so the caption/downloads can never describe a
    // stale image.
    const target = value ?? window.location.href;
    let cancelled = false;

    Promise.all([
      QRCode.toDataURL(target, {
        width: size * 2, // 2x so it stays crisp on a retina screen and in print
        margin: 1,
        errorCorrectionLevel: "M",
        color: QR_COLOR,
      }),
      // The SVG string costs nothing extra worth avoiding, but there is no
      // reason to compute it for the many call sites that never offer a
      // download button.
      downloadFileName
        ? QRCode.toString(target, {
            type: "svg",
            margin: 1,
            errorCorrectionLevel: "M",
            color: QR_COLOR,
          })
        : Promise.resolve(null),
    ])
      .then(([dataUrl, svg]) => {
        if (!cancelled) setQr({ dataUrl, encoded: target, svg });
      })
      .catch(() => {
        // A QR we cannot draw is not worth crashing the page over; the link
        // is still on screen and still copyable.
      });

    return () => {
      cancelled = true;
    };
  }, [value, size, downloadFileName]);

  const svgDataUrl = qr?.svg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`
    : null;

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

      {downloadFileName && qr ? (
        <div className="mt-2 flex gap-2">
          <a
            href={qr.dataUrl}
            download={`${downloadFileName}.png`}
            className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Download PNG
          </a>
          {svgDataUrl ? (
            <a
              href={svgDataUrl}
              download={`${downloadFileName}.svg`}
              className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Download SVG
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
