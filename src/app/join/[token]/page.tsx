// The landing page behind an invite link (PRD §6.1: "Guide receives an
// invite link from their company; account auto-links to that company.
// 3-field form: name, email, password."). Deliberately outside /studio/ —
// see src/lib/studio/shareLinks.ts's buildInviteUrl for why: every /studio/*
// route is gated by src/proxy.ts's studioAuthGate, which would bounce a
// logged-out invitee to /studio/login before they ever saw this page.
//
// This is a placeholder, not the full PRD §6.1 signup flow: there is no
// real Supabase Auth yet to create an account against, so there is nothing
// real for a 3-field form to submit to. Building that is a follow-up, once
// auth exists. What this page DOES do honestly: confirm the link is real
// and well-formed, and tell the invitee what happens next — rather than
// 404ing on a link Studio just told them was theirs.
//
// TODO: once real Supabase Auth exists, replace this with the actual
// signup form (name/email prefilled from the invite, password field), which
// on submit creates the auth user, links it to the existing guide row (by
// looking up `invite_token`), and sets that guide's status to 'active'.

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-100 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">You&rsquo;ve been invited</h1>
        <p className="text-sm text-neutral-500">
          Your company has invited you to join as a guide. Sign-up isn&rsquo;t wired up
          yet — this link is real and yours to keep, but there&rsquo;s no account
          system behind it until Studio&rsquo;s real sign-in ships.
        </p>
        <p className="break-all rounded-lg bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-500">
          Invite token: {token}
        </p>
      </div>
    </div>
  );
}
