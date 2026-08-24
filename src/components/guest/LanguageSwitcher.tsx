"use client";

// The guest language switcher — a compact pill (Globe icon + current locale
// code, "EN") opening a small dropdown listing every supported language by
// its own native name (see LOCALE_NAMES), each with its flag (LOCALE_FLAGS). Per the founder's annotation it sits
// top-right of the List screen's gradient header (via GuestScreenHeader's
// `action` slot) and top-right of the Map screen's floating overlay stack —
// hence the two `tone` variants: translucent white ON the brand gradient,
// and the same white/95 backdrop-blur pill language as the map's floating
// header chrome.
//
// On select it writes the `map_app_lang` cookie (1 year, path=/,
// SameSite=Lax) and calls router.refresh(), so the server layout re-resolves
// the locale and every server AND client guest component re-renders in the
// new language. No route change, no middleware — presentation state only.

import { Check, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { bodyFontFamily } from "@/lib/fonts";
import { BORDER, INK, MUTED, SHADOW_CARD } from "@/lib/guestTheme";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  LOCALE_COOKIE,
  LOCALE_FLAGS,
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n/locales";

/** 1 year, whole guest app, first-party only. Module-level (not inside the
 * component) — writing document.cookie is a browser side effect, not
 * component state. */
function writeLocaleCookie(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
}

export interface LanguageSwitcherProps {
  /**
   * "header": translucent white pill for the gradient GuestScreenHeader.
   * "floating": white/95 backdrop-blur pill for the map's overlay stack.
   */
  tone?: "header" | "floating";
}

export function LanguageSwitcher({ tone = "header" }: LanguageSwitcherProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on any tap outside — a dropdown floating over a map/scroll area
  // must never require finding its own trigger again to dismiss.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function selectLocale(next: Locale) {
    setOpen(false);
    if (next !== locale) {
      writeLocaleCookie(next);
      // Re-render the server tree with the new cookie — the (guest) layout
      // re-resolves the locale and LocaleProvider re-mounts with it.
      router.refresh();
    }
  }

  const triggerStyle =
    tone === "header"
      ? {
          background: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.32)",
          color: "#FFFFFF",
        }
      : {
          background: "rgba(255,255,255,0.95)",
          border: `1px solid ${BORDER}`,
          color: INK,
          boxShadow: SHADOW_CARD,
        };

  return (
    <div ref={rootRef} className="relative" style={{ fontFamily: bodyFontFamily }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${t.common.languageLabel}: ${LOCALE_NAMES[locale]}`}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.75rem] font-semibold${
          tone === "floating" ? " backdrop-blur" : ""
        }`}
        style={{
          ...triggerStyle,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        <Globe className="h-4 w-4" strokeWidth={2} aria-hidden />
        {locale.toUpperCase()}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t.common.languageLabel}
          className="absolute right-0 z-50 mt-2 min-w-[11rem] rounded-2xl bg-white p-1.5"
          style={{ border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}
        >
          {SUPPORTED_LOCALES.map((code) => {
            const selected = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                lang={code}
                onClick={() => selectLocale(code)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm"
                style={{
                  border: 0,
                  background: "transparent",
                  color: selected ? "var(--brand-primary)" : INK,
                  fontWeight: selected ? 600 : 500,
                  fontFamily: bodyFontFamily,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}
              >
                <span className="inline-flex items-center gap-2.5">
                  {/* Decorative flag — the native name is the accessible text. */}
                  <span aria-hidden="true" className="text-base leading-none">
                    {LOCALE_FLAGS[code]}
                  </span>
                  {LOCALE_NAMES[code]}
                </span>
                {selected ? (
                  <Check
                    className="h-4 w-4 shrink-0"
                    strokeWidth={2.2}
                    style={{ color: "var(--brand-primary)" }}
                    aria-hidden
                  />
                ) : (
                  <span className="h-4 w-4 shrink-0" aria-hidden style={{ color: MUTED }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
