"use client";

// Studio > Campaign (PRD §7.6, company-only). One field, saved once, merged
// onto every boat tour's booking button automatically — see the page-level
// comment in src/app/studio/campaign/page.tsx for exactly how that merge
// reaches a real booking URL and what integration point is still open.

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";

import { saveCampaignParamsAction, type SaveCampaignActionState } from "@/lib/studio/campaignActions";
import { previewCampaignBookingUrl } from "@/lib/studio/campaignParams";
import { Eyebrow, PrimaryButton, inputClass, labelClass } from "./primitives";

const initialState: SaveCampaignActionState = {};

function draftKey(companyId: string): string {
  return `boatlocal:studio:campaignDraft:${companyId}`;
}

function readDraft(companyId: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(companyId));
  } catch {
    // Storage disabled (private browsing, locked-down browser) — behave as
    // if there were never a draft rather than throwing.
    return null;
  }
}

/** Never actually notifies — see the read below for why that's fine. */
const subscribeNever = () => () => {};
const getServerDraft = () => null;

export default function CampaignForm({
  companyId,
  savedValue,
}: {
  companyId: string;
  savedValue: string;
}) {
  const [state, formAction, pending] = useActionState(saveCampaignParamsAction, initialState);

  // localStorage doesn't exist during server rendering, so the "is there an
  // unsaved draft?" read has to resolve differently there than on the
  // client. useSyncExternalStore (rather than an effect + setState, which
  // would trip this codebase's react-hooks/set-state-in-effect rule) is the
  // documented way to do that — same idiom as GuestWelcomeScreen.tsx's
  // InstallBanner: React reconciles the server snapshot (no draft) during
  // hydration, then swaps to the real client read in the same pass. Keying
  // CampaignFields on the result forces exactly one clean remount if (and
  // only if) a real draft shows up post-hydration, so its own `value` state
  // starts from the right place instead of chasing it via another effect.
  const draft = useSyncExternalStore(subscribeNever, () => readDraft(companyId), getServerDraft);

  return (
    <CampaignFields
      key={draft ?? "no-draft"}
      companyId={companyId}
      initialValue={draft ?? savedValue}
      state={state}
      formAction={formAction}
      pending={pending}
    />
  );
}

function CampaignFields({
  companyId,
  initialValue,
  state,
  formAction,
  pending,
}: {
  companyId: string;
  initialValue: string;
  state: SaveCampaignActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  // Clears the now-redundant draft once the Server Action confirms the save
  // — a plain side effect (no setState here), so it's outside the rule
  // above. The input itself is left showing exactly what the guide typed;
  // it doesn't need to snap to the server's normalized form to be correct.
  useEffect(() => {
    if (state.savedValue != null) {
      window.localStorage.removeItem(draftKey(companyId));
    }
  }, [state.savedValue, companyId]);

  function handleChange(next: string) {
    setValue(next);
    try {
      window.localStorage.setItem(draftKey(companyId), next);
    } catch {
      // Storage disabled — the draft simply won't survive a refresh.
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className={labelClass}>
        Campaign link or tracking parameters
        <input
          name="campaignParams"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="utm_source=hotel-lobby&utm_campaign=summer2026"
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
      </label>

      <p className="text-sm text-[var(--studio-ink-soft)]">
        Paste this once — it auto-propagates onto every &ldquo;Book this tour&rdquo; link your
        guests tap, for every boat, with no need to touch each tour individually. Pasting a full
        tracking URL also works; only its query parameters are kept.
      </p>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </PrimaryButton>

      <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] p-4">
        <Eyebrow>Preview — example booking link</Eyebrow>
        <p className="mt-1 font-mono text-xs break-all text-[var(--studio-ink)]">
          {previewCampaignBookingUrl(value)}
        </p>
      </div>
    </form>
  );
}
