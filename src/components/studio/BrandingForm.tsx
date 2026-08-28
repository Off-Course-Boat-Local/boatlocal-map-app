"use client";

// Studio Branding form (PRD §7.2, company role only): logo upload,
// primary + accent colour (hex input + presets), app name, wired live into
// PhonePreviewPanel via StudioPreviewContext.

import { useRef, useState, type ChangeEvent } from "react";

import { BRANDS } from "@/lib/brand";
import type { UpdateCompanyBrandingInput } from "@/lib/data/source";
import type { CompanyRecord } from "@/lib/data/types";
import { saveCompanyBrandingAction } from "@/lib/studio/brandingActions";
import { darkenHex, isValidHexColor } from "@/lib/studio/color";
import { fileToDataUrl, InvalidLogoFileError } from "@/lib/studio/fileToDataUrl";
import type { Brand } from "@/lib/types";

import { CARD_SHADOW, GhostButton, PageHeader, PrimaryButton, inputClass, labelClass } from "./primitives";
import { useStudioPreview } from "./StudioPreviewContext";

export interface BrandingFormProps {
  companyId: string;
  initialBrand: Brand;
  initialLogoUrl: string | null;
  saveAction?: (
    companyId: string,
    input: UpdateCompanyBrandingInput,
  ) => Promise<CompanyRecord>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const PRIMARY_PRESETS = Object.values(BRANDS).map((b) => ({ hex: b.primary, name: b.companyName }));
const ACCENT_PRESETS = Object.values(BRANDS).map((b) => ({ hex: b.accent, name: b.companyName }));

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
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#2B4FE0"
          spellCheck={false}
          className={`w-32 rounded-xl border px-3 py-2 font-mono text-sm outline-none transition-colors ${
            valid
              ? "border-[var(--studio-border)] text-[var(--studio-ink)] focus:border-[var(--studio-accent)] focus:ring-2 focus:ring-[var(--studio-accent)]/15"
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
                ? "border-[var(--studio-ink)]"
                : "border-[var(--studio-surface)] ring-1 ring-[var(--studio-border)]"
            }`}
            style={{ background: preset.hex }}
          />
        ))}
      </div>
    </div>
  );
}

export default function BrandingForm({
  companyId,
  initialBrand,
  initialLogoUrl,
  saveAction = saveCompanyBrandingAction,
}: BrandingFormProps) {
  const preview = useStudioPreview();

  const [appName, setAppName] = useState(initialBrand.appName);
  const [primary, setPrimary] = useState(initialBrand.primary);
  const [primaryDark, setPrimaryDark] = useState(initialBrand.primaryDark);
  const [accent, setAccent] = useState(initialBrand.accent);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pushBrand(next: Partial<Pick<Brand, "appName" | "primary" | "primaryDark" | "accent">>) {
    preview.setBrand({
      id: initialBrand.id,
      companyName: initialBrand.companyName,
      surround: initialBrand.surround,
      appName: next.appName !== undefined ? next.appName : appName,
      primary: next.primary !== undefined ? next.primary : primary,
      primaryDark: next.primaryDark !== undefined ? next.primaryDark : primaryDark,
      accent: next.accent !== undefined ? next.accent : accent,
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

  function handleDiscard() {
    setAppName(initialBrand.appName);
    setPrimary(initialBrand.primary);
    setPrimaryDark(initialBrand.primaryDark);
    setAccent(initialBrand.accent);
    setLogoUrl(initialLogoUrl);
    setLogoError(null);
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
      await saveAction(companyId, {
        appName: appName.trim(),
        brandPrimary: primary,
        brandPrimaryDark: primaryDark,
        brandAccent: accent,
        logoUrl,
      });
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Could not save. Try again.");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Branding"
        description="Changes are live in the preview immediately. Nothing is saved until you press Save — this goes live for every one of this company's guides."
      />

      <section className={`space-y-2 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}>
        <label className={labelClass} htmlFor="branding-app-name">
          App name
        </label>
        <input
          id="branding-app-name"
          type="text"
          value={appName}
          onChange={(e) => handleAppNameChange(e.target.value)}
          placeholder="e.g. Amsterdam by Canal Voyagers"
          className={inputClass}
        />
        <p className="text-xs text-[var(--studio-ink-soft)]">Shown in the guest app header.</p>
      </section>

      <section className={`space-y-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}>
        <div>
          <label className={labelClass}>Logo</label>
          <p className="text-xs text-[var(--studio-ink-soft)]">
            A clean, high-resolution SVG or PNG logo for your guest app header.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-bg)]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Company logo preview" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-[10px] tracking-wide text-[var(--studio-ink-soft)] uppercase font-semibold">No logo</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex gap-2">
              <GhostButton size="sm" onClick={() => fileInputRef.current?.click()}>
                {logoUrl ? "Replace logo" : "Upload logo"}
              </GhostButton>
              {logoUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--studio-ink-soft)] transition-colors hover:bg-[var(--studio-bg)] hover:text-[var(--studio-ink)] cursor-pointer"
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
            <p className="text-xs text-[var(--studio-ink-soft)]">PNG or SVG, up to 2MB.</p>
            {logoError ? (
              <p role="alert" className="text-xs text-red-600">
                {logoError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={`grid grid-cols-1 gap-6 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 sm:grid-cols-2 ${CARD_SHADOW}`}>
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

      <p className="-mt-3 text-xs text-[var(--studio-ink-soft)]">
        A darker shade for hover states (
        <span className="font-mono">{primaryDark}</span>) is generated automatically from the
        primary colour.
      </p>

      <div className="flex items-center gap-3">
        <PrimaryButton onClick={handleSave} disabled={saveState === "saving"}>
          {saveState === "saving" ? "Saving…" : "Save"}
        </PrimaryButton>
        <GhostButton onClick={handleDiscard} disabled={saveState === "saving"}>
          Discard changes
        </GhostButton>

        {saveState === "saved" ? (
          <p role="status" className="text-sm font-medium text-emerald-700">
            Saved.
          </p>
        ) : null}
        {saveState === "error" && saveError ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {saveError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
