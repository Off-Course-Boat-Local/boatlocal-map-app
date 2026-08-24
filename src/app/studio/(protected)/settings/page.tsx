// Settings — guide only. The account itself, as distinct from Profile,
// which is the guest-facing identity (photo, welcome message, share link).
//
// Deliberately modest right now, and honest about it. A guide's account has
// genuinely few knobs: Studio has no password to change (sign-in is a magic
// link — see src/components/studio/LoginForm.tsx), the email is the
// identity the company's invite was issued to, and status is the company's
// call, not the guide's. Rather than invent settings to fill the page, this
// shows what actually governs the account and says who to ask for the
// things a guide can't change themselves.

import { getCompanyForStudio, getGuidesForCompany } from "@/lib/data/source";
import { actorFromSession, requireDevSession, requireGuideRole } from "@/lib/studio/devAuth";
import { logoutAction } from "@/lib/studio/actions";
import { CARD_SHADOW, Eyebrow, GhostButton, PageHeader } from "@/components/studio/primitives";

export const metadata = {
  title: "Settings — Map App Studio",
};

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-b border-[var(--studio-border)] px-5 py-3.5 last:border-0">
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-1 text-sm text-[var(--studio-ink)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--studio-ink-soft)]">{hint}</p> : null}
    </div>
  );
}

export default async function StudioSettingsPage() {
  const session = await requireDevSession();
  requireGuideRole(session);
  const actor = actorFromSession(session);

  const [company, guides] = await Promise.all([
    getCompanyForStudio(actor, session.companyId),
    getGuidesForCompany(actor, session.companyId),
  ]);

  const guide = guides.find((g) => g.id === session.guideId);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Your account. To change how you appear to guests, use Profile."
      />

      <div className={`overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ${CARD_SHADOW}`}>
        <Row
          label="Signed in as"
          value={session.email}
          hint="Studio has no password — signing in always sends a one-time link to this address."
        />
        <Row
          label="Name"
          value={guide?.name ?? session.guideName}
          hint={`Set by ${company?.name ?? session.companyName} when they invited you. Ask them to change it.`}
        />
        <Row
          label="Company"
          value={company?.name ?? session.companyName}
          hint="Your picks appear inside this company's app, using their branding."
        />
        <Row
          label="Account status"
          value={guide?.status === "active" ? "Active" : (guide?.status ?? "Unknown")}
          hint="Only your company can deactivate or reactivate a guide account."
        />
      </div>

      <div className={`rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}>
        <p className="text-sm font-semibold text-[var(--studio-ink)]">Sign out</p>
        <p className="mt-1 text-xs text-[var(--studio-ink-soft)]">
          Ends this session on this device. You can sign back in any time with a
          new link.
        </p>
        <form action={logoutAction} className="mt-3">
          <GhostButton size="sm" type="submit">
            Sign out
          </GhostButton>
        </form>
      </div>
    </div>
  );
}
