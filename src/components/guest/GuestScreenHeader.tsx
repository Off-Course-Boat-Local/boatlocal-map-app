// The gradient header band every non-map guest screen starts with (List,
// Saved, Review, Install) — a direct port of the reference design's
// ScreenHeader (nice-notice's src/components/mobile-shell.tsx): a
// top-to-bottom brand gradient with an optional uppercase eyebrow, a large
// Outfit title, and an optional subtitle.
//
// Colours come exclusively from the --brand-* custom properties written by
// src/lib/brand.ts (via src/lib/guestTheme.ts's BRAND_GRADIENT) — this band
// is what makes each tenant's app instantly "theirs", so a literal hex here
// would defeat the whole white-label layer.
//
// The top padding folds in env(safe-area-inset-top) so the gradient fills
// behind the status bar in installed/standalone mode; env() is 0 in a
// normal browser tab.

import type { ReactNode } from "react";

import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { BRAND_GRADIENT } from "@/lib/guestTheme";

export interface GuestScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Uploaded via Studio > Branding (Brand.logoUrl) — null shows nothing, not a placeholder. */
  logoUrl?: string | null;
  /**
   * Optional top-right slot — e.g. the LanguageSwitcher on the List screen
   * (per the founder's annotation). A slot rather than a hardcoded switcher
   * so the header stays a dumb presentational band.
   */
  action?: ReactNode;
  children?: ReactNode;
}

export function GuestScreenHeader({
  eyebrow,
  title,
  subtitle,
  logoUrl,
  action,
  children,
}: GuestScreenHeaderProps) {
  return (
    <header
      className="shrink-0 px-5 pb-6 text-white"
      style={{
        background: BRAND_GRADIENT,
        paddingTop: "calc(env(safe-area-inset-top) + 1.75rem)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mt-0.5 size-9 shrink-0 rounded-full bg-white/95 object-contain p-1 shadow-sm"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p
                className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] opacity-75"
                style={{ fontFamily: bodyFontFamily }}
              >
                {eyebrow}
              </p>
            )}
            <h1
              className="mt-1.5 text-[1.75rem] font-semibold leading-tight"
              style={{ fontFamily: displayFontFamily, letterSpacing: "-0.02em" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="mt-1.5 text-sm leading-snug opacity-85"
                style={{ fontFamily: bodyFontFamily }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}

export default GuestScreenHeader;
