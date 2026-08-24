-- Unified Staff-managed user invitations.
--
-- Existing onboarding has two deliberately narrow invite stores:
-- `guides.invite_token` for a company's guides, and `companies.owner_*` for
-- the first company admin. Neither can represent a second company admin or a
-- Boat Local Staff account. This table is the shared invitation envelope for
-- Admin > Users; the legacy stores remain valid so existing links keep
-- working.

create table public.user_invites (
  id uuid primary key default gen_random_uuid(),
  -- The application normalises before insert; the CHECK makes that invariant
  -- true even for a future non-application writer.
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 320),
  first_name text,
  last_name text,
  role public.app_role not null,
  company_id uuid references public.companies (id) on delete cascade,
  -- Only a digest is stored. The raw bearer token exists in the emailed URL
  -- and in the successful Server Action response, never in the database.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_invites_role_shape check (
    (role = 'admin' and company_id is null)
    or (role in ('company', 'guide') and company_id is not null)
  ),
  constraint user_invites_terminal_state check (
    accepted_at is null or revoked_at is null
  )
);

comment on table public.user_invites is
  'Single-use Staff-issued invitations for Staff, company admins, and guides. Read and written only through authenticated server-side Admin flows; raw invite tokens are never stored.';
comment on column public.user_invites.token_hash is
  'SHA-256 digest of the bearer token in /join/<token>. A database read alone cannot redeem an invitation.';

-- Two concurrent Staff actions cannot leave two live invitations for the same
-- address. Accepted/revoked history does not block a later invitation.
create unique index user_invites_one_pending_per_email
  on public.user_invites (email)
  where accepted_at is null and revoked_at is null;

create index user_invites_company_id_idx on public.user_invites (company_id);
create index user_invites_pending_created_at_idx
  on public.user_invites (created_at desc)
  where accepted_at is null and revoked_at is null;

create trigger user_invites_set_updated_at
  before update on public.user_invites
  for each row execute function public.set_updated_at();

-- This table contains bearer-invite metadata and is intentionally not a
-- client-side Data API surface. All application access goes through the
-- service-role client after a Server Component/Action independently verifies
-- the caller is Staff. RLS remains enabled as defence in depth.
alter table public.user_invites enable row level security;
revoke all on table public.user_invites from anon, authenticated;
grant all on table public.user_invites to service_role;
