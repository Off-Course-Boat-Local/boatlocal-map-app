"use client";

// Studio > Campaign (PRD §7.6, company-only). One field, saved once, merged
// onto every boat tour's booking button automatically.

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";

import { saveCampaignParamsAction, type SaveCampaignActionState } from "@/lib/studio/campaignActions";
import { PrimaryButton, inputClass, labelClass } from "./primitives";

const initialState: SaveCampaignActionState = {};

function draftKey(companyId: string): string {
  return `boatlocal:studio:campaignDraft:${companyId}`;
}

function readDraft(companyId: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(companyId));
  } catch {
    return null;
  }
}

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
      // Storage disabled
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

      <p className="text-xs text-[var(--studio-ink-soft)]">
        Paste your tracking parameters once — it auto-propagates onto every booking button your guests tap across all boat tours. Pasting a full tracking URL also works; only query parameters are preserved.
      </p>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state.savedValue != null && (
        <p role="status" className="text-xs font-semibold text-emerald-600">
          Campaign parameters saved.
        </p>
      )}

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save tracking parameters"}
      </PrimaryButton>
    </form>
  );
}
