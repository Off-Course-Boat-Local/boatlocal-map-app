// Admin Outreach — one prospect's detail: enrichment info, the compose box
// (OutreachComposeForm), the pipeline actions (OutreachQuickActions), and
// the full multi-channel event timeline. Mirrors Admin Companies' own list/detail split.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Users,
  XCircle,
} from "lucide-react";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { buildDefaultOutreachDraft, outreachTouchForPriorEmails } from "@/lib/admin/outreachDraft";
import {
  formatLastContact,
  parseOutreachEvent,
} from "@/lib/admin/outreachTouchpoints";
import { getOutreachProspect, listOutreachEvents } from "@/lib/data/outreach";
import OutreachComposeForm from "@/components/admin/OutreachComposeForm";
import OutreachQuickActions from "@/components/admin/OutreachQuickActions";
import OutreachStatusDropdown from "@/components/admin/OutreachStatusDropdown";
import { Panel, SectionHeading } from "@/components/admin/primitives";

export const metadata: Metadata = { title: "Outreach prospect" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChannelIcon({ name, className = "h-3.5 w-3.5" }: { name: string; className?: string }) {
  switch (name) {
    case "MessageSquare":
      return <MessageSquare className={className} />;
    case "Calendar":
      return <Calendar className={className} />;
    case "Users":
      return <Users className={className} />;
    case "Phone":
      return <Phone className={className} />;
    case "MapPin":
      return <MapPin className={className} />;
    case "Mail":
      return <Mail className={className} />;
    case "CheckCircle2":
      return <CheckCircle2 className={className} />;
    case "XCircle":
      return <XCircle className={className} />;
    case "Building2":
      return <Building2 className={className} />;
    case "FileText":
    default:
      return <FileText className={className} />;
  }
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
  const isOpen = prospect.status === "not_contacted" || prospect.status === "emailed" || prospect.status === "replied";
  const priorEmails = events.filter((e) => e.eventType === "email_sent").length;
  const isReplied = prospect.status === "replied";
  const touch = outreachTouchForPriorEmails(priorEmails);

  const lastEmailEvent = events.find((e) => e.eventType === "email_sent" || e.eventType === "replied");
  const lastSubject = lastEmailEvent?.body ? lastEmailEvent.body.split("\n")[0].replace(/^\[Replied via Email\]\s*/, "") : null;
  const replySubject = lastSubject ? (lastSubject.startsWith("Re:") ? lastSubject : `Re: ${lastSubject}`) : `Re: ${prospect.name}`;

  const draft = isReplied
    ? {
        subject: replySubject,
        body: `Hi ${prospect.contactName?.trim().split(/\s+/)[0] ?? ""},\n\n\n\nMet vriendelijke groet,\nBeer Zoomers\nboatlocal.nl`,
        touch,
      }
    : buildDefaultOutreachDraft(prospect, { touch });
  const composeTitle = isReplied
    ? "Reply to prospect"
    : touch === 1
      ? "Send outreach email"
      : touch === 2
        ? "Send follow-up"
        : "Send last follow-up";

  const lastContact = formatLastContact(prospect.lastContactedAt, events);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-[var(--admin-ink)]">
            {prospect.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
            {[prospect.tourType, prospect.languages].filter(Boolean).join(" · ") || "No enrichment on file"}
          </p>

          {lastContact ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[var(--admin-ink-soft)]">Last touchpoint:</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${lastContact.badgeClass}`}>
                <ChannelIcon
                  name={
                    lastContact.channel === "whatsapp"
                      ? "MessageSquare"
                      : lastContact.channel === "meeting_proposed"
                        ? "Calendar"
                        : lastContact.channel === "meeting_held"
                          ? "Users"
                          : lastContact.channel === "call"
                            ? "Phone"
                            : lastContact.channel === "in_person"
                              ? "MapPin"
                              : lastContact.channel === "email"
                                ? "Mail"
                                : "FileText"
                  }
                  className="h-3 w-3"
                />
                <span>{lastContact.label} · {lastContact.relativeTime}</span>
              </span>
              {lastContact.snippet ? (
                <span className="text-[var(--admin-ink-soft)] italic truncate max-w-lg">&ldquo;{lastContact.snippet}&rdquo;</span>
              ) : null}
            </div>
          ) : (
            <div className="mt-2.5 flex items-center gap-2 text-xs text-[var(--admin-ink-soft)]">
              <span className="inline-flex items-center rounded-full border border-[var(--admin-border)] px-2 py-0.5 bg-[var(--admin-bg)]">
                Not contacted yet
              </span>
            </div>
          )}
        </div>
        <OutreachStatusDropdown prospectId={prospect.id} currentStatus={prospect.status} align="right" />
      </div>

      {lastContact?.isMeetingProposed ? (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/80 p-4 text-sm dark:border-purple-900/60 dark:bg-purple-950/30 flex items-start gap-3.5">
          <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-700 dark:text-purple-300 shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-purple-950 dark:text-purple-200 flex items-center gap-2">
              <span>Meeting proposed</span>
              <span className="text-xs font-normal text-purple-700 dark:text-purple-400">({lastContact.relativeTime})</span>
            </div>
            {lastContact.snippet ? (
              <p className="mt-1 text-sm text-purple-900/90 dark:text-purple-300/90">
                {lastContact.snippet}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {isOpen ? (
            <Panel>
              <SectionHeading title={composeTitle} />
              <OutreachComposeForm
                prospectId={prospect.id}
                toEmail={prospect.email}
                defaultSubject={draft.subject}
                defaultBody={draft.body}
                submitLabel={isReplied ? "Send reply" : touch === 1 ? "Send" : "Send follow-up"}
              />
            </Panel>
          ) : null}

          <Panel>
            <SectionHeading title="Timeline" />
            {events.length === 0 ? (
              <p className="text-sm text-[var(--admin-ink-soft)]">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-4">
                {events.map((event) => {
                  const parsed = parseOutreachEvent(event);
                  return (
                    <li key={event.id} className="border-l-2 border-[var(--admin-border)] pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${parsed.meta.toneClass}`}>
                          <ChannelIcon name={parsed.meta.iconName} className="h-3 w-3" />
                          <span>{parsed.meta.badgeLabel}</span>
                        </span>
                        <span className="text-xs text-[var(--admin-ink-soft)]">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      {parsed.cleanBody ? (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--admin-ink)]">
                          {parsed.cleanBody}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
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
              {lastContact ? (
                <div className="flex justify-between gap-3 border-t border-[var(--admin-border)] pt-2 mt-2">
                  <dt className="text-[var(--admin-ink-soft)]">Last contact</dt>
                  <dd className="text-right font-medium text-[var(--admin-ink)]">
                    {lastContact.label} ({lastContact.relativeTime})
                  </dd>
                </div>
              ) : null}
              {prospect.nextActionDueAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--admin-ink-soft)]">Next action</dt>
                  <dd className="text-right font-medium text-[var(--admin-ink)]">
                    {prospect.nextActionType === "call" ? "Call" : "Follow-up"} due {new Date(prospect.nextActionDueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </dd>
                </div>
              ) : null}
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
