"use client";

// Studio editor for the guest Home "welcome hub" (Task 6 of the welcome-hub
// plan). One list of blocks, edited inline: reorder with up/down, delete, add
// from a picker, and a single dirty-aware Save. Reordering uses buttons rather
// than drag handles — keyboard-accessible, no extra dependency.

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import PortalModal from "@/components/PortalModal";
import { BLOCK_REGISTRY, createDefaultBlock } from "@/lib/welcome-blocks/registry";
import {
  cloneCompanyHubToGuideAction,
  resetGuideHubAction,
  saveWelcomeHubAction,
} from "@/lib/studio/welcomeHubActions";
import {
  WELCOME_BLOCK_TYPES,
  type ReviewPlatform,
  type WelcomeBlock,
  type WelcomeBlockType,
} from "@/types/welcome-blocks";
import { GhostButton, Panel, PrimaryButton, StatusPill, inputClass, labelClass } from "./primitives";

export interface HubGuideOption {
  id: string;
  name: string;
}

export interface HubPlaceOption {
  id: string;
  name: string;
}

export interface WelcomeHubEditorProps {
  /** null = the company default hub. */
  guideId: string | null;
  guides: HubGuideOption[];
  places: HubPlaceOption[];
  initialBlocks: WelcomeBlock[];
  /** For a guide: whether they have their own hub (otherwise guests see the company default). */
  hasOwnHub: boolean;
}

const CATEGORY_KEYS = ["breakfast", "lunch", "dinner", "coffee", "drinks", "wine", "dancing", "see", "photo", "shop"];
const PLATFORMS: { key: ReviewPlatform; label: string }[] = [
  { key: "tripadvisor", label: "TripAdvisor" },
  { key: "google", label: "Google" },
  { key: "guruwalk", label: "GuruWalk" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContent = Record<string, any>;

function BlockFields({
  block,
  places,
  onChange,
}: {
  block: WelcomeBlock;
  places: HubPlaceOption[];
  onChange: (content: AnyContent) => void;
}) {
  const c = block.content as AnyContent;
  const set = (patch: AnyContent) => onChange({ ...c, ...patch });
  const text = (key: string, label: string, multiline = false) => (
    <Field label={label}>
      {multiline ? (
        <textarea className={inputClass} rows={3} value={c[key] ?? ""} onChange={(e) => set({ [key]: e.target.value })} />
      ) : (
        <input className={inputClass} value={c[key] ?? ""} onChange={(e) => set({ [key]: e.target.value })} />
      )}
    </Field>
  );
  const toggleIn = (key: string, value: string) => {
    const list: string[] = c[key] ?? [];
    set({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };
  const checkbox = (checked: boolean, label: string, onToggle: () => void) => (
    <label className="inline-flex items-center gap-2 text-sm text-[var(--studio-ink)]">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {label}
    </label>
  );

  switch (block.type) {
    case "guide_hero":
      return (
        <div className="space-y-3">
          {text("title", "Title")}
          {text("greeting", "Greeting", true)}
          {text("photoUrl", "Large photo URL (https://…, optional)")}
          {checkbox(c.showAvatar !== false, "Show avatar", () => set({ showAvatar: c.showAvatar === false }))}
        </div>
      );
    case "review_card":
      return (
        <div className="space-y-3">
          {text("promptText", "Prompt")}
          {PLATFORMS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              {checkbox((c.platforms ?? []).includes(key), label, () => toggleIn("platforms", key))}
              <input
                className={inputClass}
                placeholder={`${label} review link (https://…)`}
                value={c.urls?.[key] ?? ""}
                onChange={(e) => set({ urls: { ...(c.urls ?? {}), [key]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      );
    case "category_shortcuts":
      return (
        <div className="flex flex-wrap gap-3">
          {CATEGORY_KEYS.map((k) =>
            checkbox((c.categoryKeys ?? []).includes(k), k, () => toggleIn("categoryKeys", k)),
          )}
        </div>
      );
    case "featured_places":
      return (
        <div className="space-y-3">
          {checkbox(!!c.showDiscountBadge, "Show guest-discount badge", () => set({ showDiscountBadge: !c.showDiscountBadge }))}
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {places.map((p) => checkbox((c.placeIds ?? []).includes(p.id), p.name, () => toggleIn("placeIds", p.id)))}
          </div>
        </div>
      );
    case "boat_tour_card":
      return text("headline", "Headline");
    case "tip_box":
      return (
        <div className="space-y-3">
          {text("title", "Title")}
          {text("body", "Text", true)}
          <Field label="Style">
            <select className={inputClass} value={c.style ?? "tip"} onChange={(e) => set({ style: e.target.value })}>
              <option value="tip">Tip</option>
              <option value="warning">Warning (what to avoid)</option>
            </select>
          </Field>
        </div>
      );
    case "heading":
      return (
        <div className="space-y-3">
          {text("text", "Text")}
          <Field label="Level">
            <select className={inputClass} value={c.level ?? 2} onChange={(e) => set({ level: Number(e.target.value) })}>
              <option value={2}>Large</option>
              <option value={3}>Small</option>
            </select>
          </Field>
        </div>
      );
    case "paragraph":
      return text("text", "Text", true);
    case "image":
      return (
        <div className="space-y-3">
          {text("url", "Image URL (https://…)")}
          {text("alt", "Alt text")}
          {text("caption", "Caption")}
        </div>
      );
    case "quote":
      return (
        <div className="space-y-3">
          {text("quote", "Quote", true)}
          {text("author", "Author")}
        </div>
      );
    case "faq_group":
      return (
        <div className="space-y-3">
          {(c.items ?? []).map((item: { question: string; answer: string }, i: number) => (
            <div key={i} className="space-y-1 rounded-xl border border-[var(--studio-border)] p-3">
              <input
                className={inputClass}
                placeholder="Question"
                value={item.question}
                onChange={(e) => set({ items: c.items.map((x: AnyContent, j: number) => (j === i ? { ...x, question: e.target.value } : x)) })}
              />
              <textarea
                className={inputClass}
                rows={2}
                placeholder="Answer"
                value={item.answer}
                onChange={(e) => set({ items: c.items.map((x: AnyContent, j: number) => (j === i ? { ...x, answer: e.target.value } : x)) })}
              />
              <GhostButton size="sm" onClick={() => set({ items: c.items.filter((_: unknown, j: number) => j !== i) })}>
                Remove question
              </GhostButton>
            </div>
          ))}
          <GhostButton size="sm" onClick={() => set({ items: [...(c.items ?? []), { question: "", answer: "" }] })}>
            Add question
          </GhostButton>
        </div>
      );
    case "cta_banner":
      return (
        <div className="space-y-3">
          {text("label", "Button label")}
          {text("href", "Link (https://… or /map)")}
        </div>
      );
  }
}

export default function WelcomeHubEditor({ guideId, guides, places, initialBlocks, hasOwnHub }: WelcomeHubEditorProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<WelcomeBlock[]>(initialBlocks);
  const [saved, setSaved] = useState(() => JSON.stringify(initialBlocks.map(({ type, content }) => ({ type, content }))));
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const snapshot = (list: WelcomeBlock[]) => JSON.stringify(list.map(({ type, content }) => ({ type, content })));
  const dirty = snapshot(blocks) !== saved;

  const move = (i: number, delta: number) =>
    setBlocks((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const run = (fn: () => Promise<{ error?: string }>, okText: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) return setMessage({ tone: "error", text: res.error });
      setMessage({ tone: "ok", text: okText });
      after?.();
    });

  const save = () =>
    run(() => saveWelcomeHubAction(guideId, blocks), "Saved.", () => {
      setSaved(snapshot(blocks));
      router.refresh();
    });

  const selectGuide = (id: string) => {
    if (dirty && !confirm("You have unsaved changes. Switch anyway?")) return;
    router.push(id ? `/studio/welcome-hub?guide=${encodeURIComponent(id)}` : "/studio/welcome-hub");
  };

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-end gap-3">
        <Field label="Editing">
          <select className={inputClass} value={guideId ?? ""} onChange={(e) => selectGuide(e.target.value)}>
            <option value="">Company default</option>
            {guides.map((g) => (
              <option key={g.id} value={g.id}>
                Guide: {g.name}
              </option>
            ))}
          </select>
        </Field>
        {guideId ? (
          <>
            <StatusPill tone={hasOwnHub ? "positive" : "neutral"}>
              {hasOwnHub ? "Own hub" : "Using company default"}
            </StatusPill>
            {!hasOwnHub ? (
              <GhostButton
                disabled={pending}
                onClick={() => run(() => cloneCompanyHubToGuideAction(guideId), "Copied from the company template.", () => router.refresh())}
              >
                Kopieer van Company Template
              </GhostButton>
            ) : (
              <GhostButton
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this guide's hub and go back to the company default?"))
                    run(() => resetGuideHubAction(guideId), "Reset to the company default.", () => router.refresh());
                }}
              >
                Reset to company default
              </GhostButton>
            )}
          </>
        ) : null}
      </Panel>

      {blocks.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--studio-ink-soft)]">
            No blocks yet — guests see the standard Home screen. Add a block to start.
          </p>
        </Panel>
      ) : null}

      {blocks.map((block, i) => (
        <Panel key={block.id}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--studio-ink)]">{BLOCK_REGISTRY[block.type].label}</span>
            <div className="flex gap-1">
              <GhostButton size="sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </GhostButton>
              <GhostButton size="sm" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </GhostButton>
              <GhostButton
                size="sm"
                aria-label="Delete block"
                onClick={() => setBlocks((prev) => prev.filter((b) => b.id !== block.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </GhostButton>
            </div>
          </div>
          <BlockFields
            block={block}
            places={places}
            onChange={(content) =>
              setBlocks((prev) => prev.map((b) => (b.id === block.id ? ({ ...b, content } as WelcomeBlock) : b)))
            }
          />
        </Panel>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <GhostButton onClick={() => setPicking(true)}>
          <Plus className="h-4 w-4" /> Add block
        </GhostButton>
        <PrimaryButton disabled={!dirty || pending} onClick={save}>
          {pending ? "Saving…" : "Save blocks"}
        </PrimaryButton>
        {dirty ? <span className="text-xs text-[var(--studio-ink-soft)]">Unsaved changes</span> : null}
        {message ? (
          <span role="status" className={`text-sm ${message.tone === "error" ? "text-red-600" : "text-[var(--studio-ink-soft)]"}`}>
            {message.text}
          </span>
        ) : null}
      </div>

      <PortalModal open={picking} onClose={() => setPicking(false)} title="Add a block">
        <div className="grid gap-2">
          {WELCOME_BLOCK_TYPES.map((type: WelcomeBlockType) => (
            <button
              key={type}
              type="button"
              className="rounded-xl border border-[var(--studio-border)] p-3 text-left hover:bg-[var(--studio-bg)]"
              onClick={() => {
                setBlocks((prev) => [...prev, createDefaultBlock(type, prev.length)]);
                setPicking(false);
              }}
            >
              <span className="block text-sm font-semibold text-[var(--studio-ink)]">{BLOCK_REGISTRY[type].label}</span>
              <span className="block text-xs text-[var(--studio-ink-soft)]">{BLOCK_REGISTRY[type].description}</span>
            </button>
          ))}
        </div>
      </PortalModal>
    </div>
  );
}
