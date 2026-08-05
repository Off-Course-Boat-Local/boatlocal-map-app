"use client";

// Studio Branding form (PRD §7.2, company role only): logo upload,
// primary + accent colour (hex input + presets), app name, and a welcome
// copy field, wired live into PhonePreviewPanel via StudioPreviewContext —
// see that module's header comment for why it exists.
//
// Persistence is split, deliberately, in two different ways for two
// different reasons (both commented at their own source):
//   - App name / colours / logo -> saveCompanyBrandingAction()
//     (src/lib/studio/brandingActions.ts) -> updateCompanyBranding()
//     (src/lib/data/source.ts), which already carries the
//     "TODO: replace with Supabase query" comment. This is the real
//     DataSource-backed save path, not a placeholder invented here.
//   - Welcome copy -> localStorage only (src/lib/studio/welcomeCopyDraft.ts)
//     because CompanyRecord has no column for it yet — see that file's
//     header comment for the full reasoning.
//
// primaryDark is not its own picker (PRD only asks for primary + accent):
// it is derived automatically from primary via darkenHex() whenever primary
// changes, and left untouched otherwise so an edit-free Save never
// overwrites a hand-tuned dark shade with a generic one.

import { useCallback, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";

import { BRANDS } from "@/lib/brand";
import { saveCompanyBrandingAction } from "@/lib/studio/brandingActions";
import { darkenHex, isValidHexColor } from "@/lib/studio/color";
import { fileToDataUrl, InvalidLogoFileError } from "@/lib/studio/fileToDataUrl";
import { getWelcomeCopyDraft, setWelcomeCopyDraft } from "@/lib/studio/welcomeCopyDraft";
import type { Brand } from "@/lib/types";

import { useStudioPreview } from "./StudioPreviewContext";

export interface BrandingFormProps {
  companyId: string;
  /** The company's brand as currently saved — also this form's "discard changes" target. */
  initialBrand: Brand;
  initialLogoUrl: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const PRIMARY_PRESETS = Object.values(BRANDS).map((b) => ({ hex: b.primary, name: b.companyName }));
const ACCENT_PRESETS = Object.values(BRANDS).map((b) => ({ hex: b.accent, name: b.companyName }));

// useSyncExternalStore plumbing for the welcome-copy draft (see the ref
// declaration below for why it, not useState+useEffect, reads it). Module-
// scope, stable references: subscribeToNothing never calls back (this form
// is the only writer, and only ever on Save), and getServerWelcomeCopySnapshot
// always returns "" (no `window` on the server, matching welcomeCopyDraft.ts).
function subscribeToNothing(): () => void {
  return () => {};
}
function getServerWelcomeCopySnapshot(): string {
  return "";
}

function ColorField({
  id,
  label,
  value,
  presets,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  presets: { hex: string; name: string }[];
  onChange: (hex: string) => void;
}) {
  const valid = isValidHexColor(value);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          // Native colour inputs require a full #rrggbb value; fall back to
          // black rather than crashing on a mid-edit or invalid hex string.
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-neutral-300 bg-white p-0.5"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#2B4FE0"
          spellCheck={false}
          className={`w-32 rounded-lg border px-3 py-2 font-mono text-sm outline-none ${
            valid
              ? "border-neutral-300 text-neutral-900 focus:border-neutral-500"
              : "border-red-400 text-red-700 focus:border-red-500"
          }`}
        />
      </div>
      {!valid ? (
        <p className="mt-1 text-xs text-red-600">Enter a hex colour like #2B4FE0.</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            onClick={() => onChange(preset.hex)}
            title={`${preset.name} — ${preset.hex}`}
            aria-label={`Use ${preset.name}'s ${label.toLowerCase()} (${preset.hex})`}
            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
              value.toLowerCase() === preset.hex.toLowerCase()
                ? "border-neutral-900"
                : "border-white ring-1 ring-neutral-200"
            }`}
            style={{ background: preset.hex }}
          />
        ))}
      </div>
    </div>
  );
}

export default function BrandingForm({ companyId, initialBrand, initialLogoUrl }: BrandingFormProps) {
  const preview = useStudioPreview();

  const [appName, setAppName] = useState(initialBrand.appName);
  const [primary, setPrimary] = useState(initialBrand.primary);
  const [primaryDark, setPrimaryDark] = useState(initialBrand.primaryDark);
  const [accent, setAccent] = useState(initialBrand.accent);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Welcome copy is an *uncontrolled* textarea (see the ref below), and its
  // starting value comes from useSyncExternalStore rather than a plain
  // useState initializer — the same reason src/hooks/useSavedPlaces.ts
  // reaches for it: localStorage is only readable once `window` exists, the
  // server always sees "" (getServerSnapshot below), and useSyncExternalStore
  // is the one hook React guarantees will reconcile that server/client
  // difference without a hydration-mismatch error — no effect, no flash.
  // There is genuinely nothing to *subscribe* to (this form is the only
  // writer, and only writes on Save, never mid-edit), so `subscribe` is a
  // permanent no-op rather than something wired to storage/custom events.
  const initialWelcomeCopy = useSyncExternalStore(
    subscribeToNothing,
    useCallback(() => getWelcomeCopyDraft(companyId), [companyId]),
    getServerWelcomeCopySnapshot,
  );
  const welcomeCopyRef = useRef<HTMLTextAreaElement>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pushBrand(next: Partial<Pick<Brand, "appName" | "primary" | "primaryDark" | "accent">>) {
    preview.setBrand({
      id: initialBrand.id,
      companyName: initialBrand.companyName,
      surround: initialBrand.surround,
      appName,
      primary,
      primaryDark,
      accent,
      ...next,
    });
  }

  function markDirty() {
    if (saveState !== "idle") {
      setSaveState("idle");
      setSaveError(null);
    }
  }

  function handleAppNameChange(value: string) {
    markDirty();
    setAppName(value);
    pushBrand({ appName: value });
  }

  function handlePrimaryChange(value: string) {
    markDirty();
    setPrimary(value);
    const nextDark = isValidHexColor(value) ? darkenHex(value) : primaryDark;
    setPrimaryDark(nextDark);
    pushBrand({ primary: value, primaryDark: nextDark });
  }

  function handleAccentChange(value: string) {
    markDirty();
    setAccent(value);
    pushBrand({ accent: value });
  }

  async function handleLogoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    markDirty();
    setLogoError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoUrl(dataUrl);
      preview.setLogoUrl(dataUrl);
    } catch (err) {
      setLogoError(err instanceof InvalidLogoFileError ? err.message : "Could not read that file.");
    }
  }

  function handleRemoveLogo() {
    markDirty();
    setLogoUrl(null);
    setLogoError(null);
    preview.setLogoUrl(null);
  }

  function handleWelcomeCopyChange() {
    markDirty();
  }

  function handleDiscard() {
    setAppName(initialBrand.appName);
    setPrimary(initialBrand.primary);
    setPrimaryDark(initialBrand.primaryDark);
    setAccent(initialBrand.accent);
    setLogoUrl(initialLogoUrl);
    setLogoError(null);
    if (welcomeCopyRef.current) welcomeCopyRef.current.value = initialWelcomeCopy;
    setSaveState("idle");
    setSaveError(null);
    preview.setBrand(initialBrand);
    preview.setLogoUrl(initialLogoUrl);
  }

  async function handleSave() {
    if (!isValidHexColor(primary) || !isValidHexColor(accent)) {
      setSaveState("error");
      setSaveError("Fix the highlighted colour field before saving.");
      return;
    }
    if (!appName.trim()) {
      setSaveState("error");
      setSaveError("App name can't be empty.");
      return;
    }

    setSaveState("saving");
    setSaveError(null);
    try {
      await saveCompanyBrandingAction(companyId, {
        appName: appName.trim(),
        brandPrimary: primary,
        brandPrimaryDark: primaryDark,
        brandAccent: accent,
        logoUrl,
      });
      // Placeholder persistence for the one field with no schema column yet
      // — see welcomeCopyDraft.ts.
      setWelcomeCopyDraft(companyId, welcomeCopyRef.current?.value ?? "");
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Could not save. Try again.");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Branding</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Changes are live in the preview immediately. Nothing is saved until you press Save —
          this goes live for every one of this company&apos;s guides.
        </p>
      </div>

      <section className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
        <label className="block text-sm font-medium text-neutral-700" htmlFor="branding-app-name">
          App name
        </label>
        <input
          id="branding-app-name"
          type="text"
          value={appName}
          onChange={(e) => handleAppNameChange(e.target.value)}
          placeholder="Jan's Amsterdam"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
        />
        <p className="text-xs text-neutral-500">Shown in the guest app header.</p>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-700">Logo</p>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL upload preview, same pattern as ShareQr/PlaceCard/PhotoGallery.
              <img src={logoUrl} alt="Company logo preview" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">No logo</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {logoUrl ? "Replace logo" : "Upload logo"}
              </button>
              {logoUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/svg+xml"
              onChange={handleLogoFileChange}
              className="sr-only"
              aria-label="Upload logo"
            />
            <p className="text-xs text-neutral-500">PNG or SVG, up to 2MB.</p>
            {logoError ? (
              <p role="alert" className="text-xs text-red-600">
                {logoError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <ColorField
          id="branding-primary-color"
          label="Primary colour"
          value={primary}
          presets={PRIMARY_PRESETS}
          onChange={handlePrimaryChange}
        />
        <ColorField
          id="branding-accent-color"
          label="Accent colour"
          value={accent}
          presets={ACCENT_PRESETS}
          onChange={handleAccentChange}
        />
      </section>

      <p className="-mt-3 text-xs text-neutral-500">
        A darker shade for hover states (
        <span className="font-mono">{primaryDark}</span>) is generated automatically from the
        primary colour.
      </p>

      <section className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
        <label className="block text-sm font-medium text-neutral-700" htmlFor="branding-welcome-copy">
          Welcome copy
        </label>
        <textarea
          id="branding-welcome-copy"
          ref={welcomeCopyRef}
          defaultValue={initialWelcomeCopy}
          onChange={handleWelcomeCopyChange}
          rows={3}
          placeholder="A short hello shown to guests when they first open the app."
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
        />
        <p className="text-xs text-neutral-500">
          Saved to this browser only for now — there is no database column for it yet, so it
          doesn&apos;t sync anywhere else.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {saveState === "saving" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={saveState === "saving"}
          className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
        >
          Discard changes
        </button>

        {saveState === "saved" ? (
          <p role="status" className="text-sm text-emerald-700">
            Saved.
          </p>
        ) : null}
        {saveState === "error" && saveError ? (
          <p role="alert" className="text-sm text-red-600">
            {saveError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
