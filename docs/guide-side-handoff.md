# Brief: Guide side of Studio

You own the **guide** half of Studio. A parallel stream owns the **company admin**
half plus all shared auth, onboarding and invite infrastructure. A third branch
owns the Admin (Boat Local staff) portal — neither of us touches
`src/app/admin/**`, `src/lib/admin/**`, `src/components/admin/**`.

## Terminology (exact words, in all UI copy)

- **Staff** — Boat Local's own people. `profiles.role = 'admin'`. Admin portal only.
- **Company admin** — a company's own administrator. `profiles.role = 'company'`.
- **Guide** — belongs to exactly one company. `profiles.role = 'guide'`.

Never render the bare word "Admin" anywhere in Studio. Where a page means Boat
Local's people, it reads "Staff". The `app_role` enum stays
`('admin','company','guide')` — copy change only, **not** a migration.

## The product rule that defines your scope

**A guide only ever sees their own data. A company admin sees everything across
the company.** That is the axis the whole role split runs on:

| | Guide | Company admin |
|---|---|---|
| Recommendations | Own picks, editable; company base list read-only | Every guide's picks + the base list they own |
| Statistics | Scoped to **their own share link only** | Company-wide, aggregated across every guide |
| Profile | Their guest-facing identity | The company's identity (separate stream) |

A guide must never be able to see another guide's numbers, or the company
totals, through any page, action, or API route. Assume someone will try by
guessing a URL and by POSTing to a Server Action directly.

## What you own

- `src/app/studio/(protected)/profile/**` — guide-only, `requireGuideRole`
- `src/app/studio/(protected)/settings/**` — guide-only (see the password note below)
- `src/app/studio/(protected)/link-qr/**` — the redirect stub
- `src/components/studio/GuideProfileForm.tsx`
- The **guide branch** of the shared Dashboard and Recommendations pages
- Guide-scoped statistics: whatever queries/aggregations serve "this guide's own link"

## What you do NOT touch

Auth, onboarding and invites are being reworked wholesale on the other stream.
Editing these will conflict:

- `src/app/studio/login/**`
- `src/app/join/[token]/**`
- `src/app/auth/**`
- `src/lib/studio/devAuth.ts`, `src/lib/studio/session.ts`, `src/lib/studio/actions.ts`
- `src/proxy.ts`
- Company-only pages: `branding`, `guides`, `boat-tours`, `campaign`, `report`,
  and a new company-profile page
- Anything under `src/app/admin/**`, `src/lib/admin/**`, `src/components/admin/**`

## Shared files — coordinate before editing

These are role-branched, so we will both need them. Say so before you start on
one, and keep each change inside your own role's branch of the conditional
rather than restructuring the file:

- `src/app/studio/(protected)/page.tsx` — Dashboard, branches on role
- `src/app/studio/(protected)/recommendations/page.tsx`
- `src/components/studio/RecommendationsManager.tsx` — takes `role` + `currentGuideId`
- `src/lib/studio/nav.ts` — `GUIDE_NAV` is yours, `COMPANY_NAV` is not.
  Heads up: `COMPANY_NAV` is gaining entries, so expect churn here.
- `src/lib/studio/mockAnalytics.ts`
- `src/components/studio/dashboard/**`
- `src/lib/data/source.ts` — very high conflict risk, it is one large module

**Migrations:** we are both writing SQL. Announce the filename before you create
one so we don't collide in the timestamp space, and never edit a migration the
other stream has already written.

## Decisions already made that constrain you

**1. Studio is moving to email + password as the primary sign-in.** Magic link
is being retained as a secondary option; a forgot-password/reset flow is being
added. This directly invalidates two things on your side:

- `src/app/studio/(protected)/settings/page.tsx` currently says "Studio has no
  password to change (sign-in is a magic link)". That becomes false. Settings
  will need a real change-password control.
- Same for the header comment on that file explaining why the page is modest.

Don't build it yet — wait until password auth lands, then wire the guide's
Settings to the shared helper rather than calling Supabase directly.

**2. Names are splitting into first/last on `profiles`, not on `guides`.**
A `profiles.first_name` / `profiles.last_name` pair is being added.
`guides.name` **stays a single public display string** and is not changing,
because it feeds two live things:

- the public URL slug, via `uniqueSlug(input.name, …)` in `src/lib/data/source.ts`
  — and redemption overwrites `name` without regenerating `slug`, so they can
  already diverge
- guest-facing copy: `— {guideName}`, `{n} recommendations from {guideName}`,
  `{guideName}'s top pick`

At redemption `guides.name` will default to the **first name only**, preserving
today's guest copy. If you build any guide-name editing UI, edit `guides.name`
as a display name; do not try to compose it from first/last.

**3. A `company_invites` table is being added** so a company admin can invite a
second company admin (the current `companies.owner_*` columns model exactly one
owner). Guide invites stay on `guides.invite_token` for now — your redemption
path is unchanged in phase 1. Don't build against `company_invites`.

## Known security issue — do not build on it

`profiles`'s `self_update` RLS policy is
`using (id = auth.uid()) with check (id = auth.uid())` with no guard on the
privileged columns. This was confirmed exploitable against the dev database with
a real signed-in session and the public anon key: a Studio user can
`PATCH /rest/v1/profiles?id=eq.<own-uid>` setting
`{"role":"admin","company_id":null,"guide_id":null}` and become Staff. The test
row was restored immediately.

A fix (a `BEFORE UPDATE` trigger making `role`/`company_id`/`guide_id`
immutable to non-Staff) is going in on the other stream. Until it lands:

- Do not add any client-reachable write path to `profiles`.
- If a guide needs to edit their own name, route it through a Server Action that
  writes only the specific columns, never a passthrough of client-supplied
  fields.

## Non-negotiables from the existing codebase

- **Never branch a sign-in or invite response on whether an email exists or is
  authorized.** Both login actions deliberately return identical responses
  either way — there are comments describing a real bug found in QA. Preserve
  this in anything you touch.
- **A `profiles` row is only ever created deliberately** by invite redemption or
  the Staff allowlist check. Never as a side effect of signing in.
- **The service-role client (`createAdminClient`) is only for operations that
  genuinely cannot go through RLS** — e.g. reading an unredeemed invite for a
  visitor with no session. Not a convenience. `src/app/join/[token]/page.tsx`
  documents the standard for when it is justified.
- **Every Server Action re-checks its own actor.** A `"use server"` action is a
  public POST endpoint regardless of which layout wraps its page. `src/proxy.ts`
  is a routing convenience, never the security boundary. The three-layer model
  (proxy → page guard → action guard) is documented in `src/proxy.ts`'s header;
  follow it.

## Local setup

Studio sign-in is magic-link only until password auth lands. To sign in as the
seeded guide without waiting for an email, mint a link with the service-role key:

    node --env-file=.env.local -e '...generateLink({type:"magiclink", email:"demo-guide@example.com"})'

then open `/auth/confirm?token_hash=<hashed_token>&type=magiclink&next=/studio`.
Tokens are single-use — mint a fresh one per sign-in.

Seeded: `demo-guide@example.com` → guide "Jan" under "Boat & Bike Co.";
`demo-company@example.com` → that company's admin.

**Two dev streams, one machine:** we share port 3000 and one browser cookie jar,
so signing in as a guide silently replaces the other stream's company session
and vice versa. Set `"autoPort": true` in `.claude/launch.json` and run your own
server rather than fighting over the cookie.

## First thing to report back

Before writing code, confirm:

1. How you intend to scope guide statistics to a single share link — which
   events, keyed off what, and how you'll prove a guide can't read another's.
2. Whether the guide Dashboard's numbers stay mock for now or you're wiring real
   event counts (the company side's Report page already shows real counts, so
   we should agree on one aggregation layer rather than two).
3. Anything in the shared-files list you expect to need in your first pass.
