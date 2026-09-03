// Admin Outreach — one prospect's detail: enrichment info, the compose box
// (OutreachComposeForm), the pipeline actions (OutreachQuickActions), and
// the full event timeline. Mirrors Admin Companies' own list/detail split.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { buildDefaultOutreachDraft, outreachTouchForPriorEmails } from "@/lib/admin/outreachDraft";
import { getOutreachProspect, listOutreachEvents, type OutreachEventType } from "@/lib/data/outreach";
import OutreachComposeForm from "@/components/admin/OutreachComposeForm";
import OutreachQuickActions from "@/components/admin/OutreachQuickActions";
import { Panel, SectionHeading } from "@/components/admin/primitives";
import StatusBadge from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Outreach prospect" };

const EVENT_LABEL: Record<OutreachEventType, string> = {
  note: "Note",
  email_sent: "Email sent",
  call_logged: "Call logged",
  replied: "Replied",
  declined: "Declined",
  onboarded: "Onboarded",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OutreachProspectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prospect = await getOutreachProspect(ADMIN_ACTOR, id);
  if (!prospect) notFound();

  const events = await listOutreachEvents(ADMIN_ACTOR, id);
  const isOpen = prospect.status === "not_contacted" || prospect.status === "emailed";
  // A different draft per touch — see outreachDraft.ts's header for why a
  // follow-up must never be the first email again.
  const priorEmails = events.filter((e) => e.eventType === "email_sent").length;
  const touch = outreachTouchForPriorEmails(priorEmails);
  const draft = buildDefaultOutreachDraft(prospect, { touch });
  const composeTitle =
    touch === 1 ? "Send outreach email" : touch === 2 ? "Send follow-up" : "Send last follow-up";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-[var(--admin-ink)]">
            {prospect.name}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--admin-ink-soft)]">
            {[prospect.tourType, prospect.languages].filter(Boolean).join(" · ") || "No enrichment on file"}
          </p>
        </div>
        <StatusBadge status={prospect.status.replace("_", " ")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {isOpen && prospect.email ? (
            <Panel>
              <SectionHeading title={composeTitle} />
              <OutreachComposeForm
                prospectId={prospect.id}
                toEmail={prospect.email}
                defaultSubject={draft.subject}
                defaultBody={draft.body}
                submitLabel={touch === 1 ? "Send" : "Send follow-up"}
              />
            </Panel>
          ) : isOpen ? (
            <Panel>
              <p className="text-sm text-[var(--admin-ink-soft)]">
                No email address on file — log a call instead, or add one via the research notes below.
              </p>
            </Panel>
          ) : null}

          <Panel>
            <SectionHeading title="Timeline" />
            {events.length === 0 ? (
              <p className="text-sm text-[var(--admin-ink-soft)]">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="border-l-2 border-[var(--admin-border)] pl-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-[var(--admin-ink)]">
                        {EVENT_LABEL[event.eventType]}
                      </span>
                      <span className="text-xs text-[var(--admin-ink-soft)]">
                        {formatDateTime(event.createdAt)}
                      </span>
                    </div>
                    {event.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--admin-ink-soft)]">
                        {event.body}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <SectionHeading title="Contact" />
            <dl className="space-y-2 text-sm">
              <Field label="Email" value={prospect.email} />
              <Field label="Phone" value={prospect.phone} />
              <Field label="Contact name" value={prospect.contactName} />
              <Field
                label="Website"
                value={prospect.website}
                href={prospect.website ? `https://${prospect.website.replace(/^https?:\/\//, "")}` : undefined}
              />
              <Field
                label="Instagram"
                value={
                  prospect.instagramHandle
                    ? `${prospect.instagramHandle}${
                        prospect.instagramFollowers ? ` (${prospect.instagramFollowers.toLocaleString()})` : ""
                      }`
                    : null
                }
              />
              <Field
                label="TripAdvisor"
                value={prospect.taRating ? `★ ${prospect.taRating} (${prospect.taReviewCount ?? 0} reviews)` : null}
                href={prospect.taUrl ?? undefined}
              />
              <Field label="Price from" value={prospect.priceFrom ? `€${prospect.priceFrom}` : null} />
              <Field label="Founded" value={prospect.yearFounded ? String(prospect.yearFounded) : null} />
            </dl>
            {prospect.notes ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-ink-soft)]">
                {prospect.notes}
              </p>
            ) : null}
          </Panel>

          <Panel>
            <SectionHeading title="Actions" />
            <OutreachQuickActions
              prospectId={prospect.id}
              status={prospect.status}
              prefillOwnerEmail={prospect.email ?? ""}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--admin-ink-soft)]">{label}</dt>
      <dd className="text-right font-medium text-[var(--admin-ink)]">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
