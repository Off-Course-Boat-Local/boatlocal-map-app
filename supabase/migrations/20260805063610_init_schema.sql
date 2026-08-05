-- Boat Local Map App — initial schema
--
-- Implements PRD §12's data model (Company, Guide, BoatTour,
-- CompanyBoatFeature, Recommendation, GuestSession, Event, User/Auth),
-- refined by decisions made after the PRD was written:
--
--   * NO google_place_id anywhere. The PRD's Places-API-backed model
--     (§9, §12) is superseded — there is no Google Places API, no Google
--     Maps JS API, and no Google API key in this product. Recommendations
--     are guide-entered: name/address/lat/lng typed in by a human, hours as
--     free text, photos guide-uploaded. See CLAUDE project rules.
--   * NO rating / review_count / star-rating column anywhere, on anything.
--     The guide's personal `note` is the endorsement. This is deliberate
--     and permanent product policy, not a v1 gap — do not add one later.
--   * Studio is ONE back office serving both "Company" and "Guide" roles,
--     gated by `profiles.role` after login — not two separate apps/tables.
--   * `category` is the fixed 8-value enum from src/lib/categories.ts.
--     Boat tours are their own table/pin category ("boats") and are never
--     rows in `recommendations` — enforced with a CHECK constraint below.
--
-- RLS is designed for real Supabase Auth (auth.uid() / auth.users), even
-- though no real Supabase project exists yet — see 20260805063611 and the
-- app-side DEV AUTH STAND-IN module for how login works until it does.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Mirrors CategoryId in src/lib/categories.ts exactly. That file is the
-- single source of truth for the category set — if it ever changes, this
-- enum must change in the same commit (via `alter type ... add value`, or a
-- new migration) and nowhere else invents a category.
create type public.category_id as enum (
  'boats',
  'breakfast',
  'lunch',
  'coffee',
  'drinks',
  'see',
  'photo',
  'shop'
);

create type public.company_type as enum ('hotel', 'tour', 'host');

-- Admin = Boat Local staff. Company/Guide = Studio users gated by role
-- (PRD §3 hierarchy, simplified per the "Studio is one back office" rule).
create type public.app_role as enum ('admin', 'company', 'guide');

create type public.recommendation_owner_type as enum ('company', 'guide');

create type public.event_type as enum (
  'app_open',
  'app_install',
  'tip_viewed',
  'tip_saved',
  'tip_unsaved',
  'directions_requested',
  'boat_book_click',
  'review_click_google',
  'review_click_tripadvisor',
  'review_private_feedback',
  'booking_outcome'
);

create type public.event_platform as enum ('ios', 'android', 'desktop', 'unknown');

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
-- One row per tenant. Branding + subdomain resolution (PRD §11, §13.1) and
-- the two review-link destinations (PRD §5.6 / hard rule: two separate
-- review flows — this table only carries flow (a), the company's own
-- public review link; flow (b), boat-tour review, is a different feature
-- and out of scope here).
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Unique subdomain label, e.g. "hotelv" -> hotelv.app.boatlocal.nl (§13.1).
  subdomain text not null unique,
  company_type public.company_type not null default 'hotel',

  -- Brand config — mirrors src/lib/types.ts `Brand` + brandCssVars() in
  -- src/lib/brand.ts. Stored as plain columns (not JSON) so a NOT NULL /
  -- CHECK can guarantee every tenant always has a full brand, matching the
  -- "brand colour is never hard-coded, always read from these four values"
  -- rule.
  app_name text not null,
  brand_primary text not null,
  brand_primary_dark text not null,
  brand_accent text not null,
  brand_surround text not null,
  logo_url text,

  -- PRD §7.6 — pasted once, auto-propagates to every booking button.
  campaign_params text,

  -- PRD §5.6 flow (a): company's own public review destinations. Either or
  -- both may be null; the guest app offers whichever exist plus the
  -- always-present "share private feedback" option — never gated by any
  -- rating, because there is no rating.
  google_review_url text,
  tripadvisor_review_url text,

  -- 'setup' added on top of the original two values for Admin's
  -- create/onboard flow (PRD §8.3): a row can exist while a new tenant is
  -- still being configured (subdomain assigned, brand not set up yet)
  -- without being guest-visible — 'active' is what PRD prose calls "live"
  -- (§2.3: "setup vs live status"). Same addition pattern as guides.status
  -- gaining 'invited' above.
  status text not null default 'active' check (status in ('setup', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is
  'Tenant. Subdomain resolves brand (PRD §11/§13.1). Admin sees all rows; a company sees only itself (RLS, next migration).';
comment on column public.companies.campaign_params is
  'Raw query-string fragment (no leading ?/&) appended to every booking handoff URL for this company. See src/lib/attribution.ts buildBookingUrl().';

-- ---------------------------------------------------------------------------
-- guides
-- ---------------------------------------------------------------------------
create table public.guides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  email text not null,
  -- Path slug, e.g. "jan" -> hotelv.app.boatlocal.nl/jan (PRD §5.1, §13.1).
  -- Unique per company, not globally — two companies may each have a "jan".
  slug text not null,
  avatar_url text,
  avatar_initial text not null default '',
  welcome_message text not null default '',
  -- 'invited' added on top of the original two values for the Studio
  -- "Guides" invite flow (PRD §7.3): a row is created at invite time (name +
  -- email known, invite_token set) but the guide has not signed up yet.
  status text not null default 'active' check (status in ('invited', 'active', 'deactivated')),
  -- Set at invite time, cleared once the guide leaves 'invited'. See
  -- src/lib/data/types.ts GuideRecord.inviteToken for why this exists before
  -- there is a real backend to redeem it against.
  invite_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);

comment on table public.guides is
  'A Studio user with role=guide belongs to exactly one guide row (PRD §3.2: no multi-company guides in v1).';

-- ---------------------------------------------------------------------------
-- profiles (User/Auth)
-- ---------------------------------------------------------------------------
-- One row per login. In production this is keyed 1:1 to auth.users (Supabase
-- Auth) once that project exists. Until then, the app's DEV AUTH STAND-IN
-- (see src/lib/auth/devAuth.ts) issues a signed dev-session cookie and never
-- writes real rows here — this table is the target shape it must match.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  -- Set iff role IN ('company','guide'); the company this profile belongs
  -- to. Null for admin.
  company_id uuid references public.companies (id) on delete cascade,
  -- Set iff role = 'guide'; null for admin and company. A guide profile's
  -- company_id must equal guides.company_id for this guide_id (checked by
  -- trigger below, since cross-table CHECK constraints aren't expressible
  -- directly in Postgres).
  guide_id uuid references public.guides (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),

  constraint profile_role_shape check (
    (role = 'admin' and company_id is null and guide_id is null)
    or (role = 'company' and company_id is not null and guide_id is null)
    or (role = 'guide' and company_id is not null and guide_id is not null)
  )
);

comment on table public.profiles is
  'User/Auth (PRD §12). role gates which Studio views render — Studio is one app, not separate Company/Guide apps.';

create or replace function public.profile_guide_company_matches()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.guide_id is not null then
    if not exists (
      select 1 from public.guides g
      where g.id = new.guide_id and g.company_id = new.company_id
    ) then
      raise exception 'profiles.company_id must match guides.company_id for guide_id %', new.guide_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guide_company_matches
  before insert or update on public.profiles
  for each row execute function public.profile_guide_company_matches();

-- ---------------------------------------------------------------------------
-- boat_tours
-- ---------------------------------------------------------------------------
-- Admin-owned catalog (PRD §8.2). Never company- or guide-scoped.
create table public.boat_tours (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  lng double precision not null,
  lat double precision not null,
  -- e.g. "90 min · €28 pp · drinks incl." — free text, matches BoatTour.meta.
  meta text not null,
  note text not null,
  -- Base booking URL on boatlocal.nl before per-company campaign params /
  -- date / guest-count / click-id query params are appended at hand-off
  -- time. See src/lib/attribution.ts buildBookingUrl() and
  -- NEXT_PUBLIC_BOOKING_BASE_URL.
  booking_url text not null,
  photos text[] not null default '{}',
  position integer not null,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.boat_tours is
  'Admin-owned catalog, minimum 6 at launch (PRD §8.2). Never a rating column — no crowd ratings anywhere in this product.';

-- ---------------------------------------------------------------------------
-- company_boat_features
-- ---------------------------------------------------------------------------
create table public.company_boat_features (
  company_id uuid not null references public.companies (id) on delete cascade,
  boat_tour_id uuid not null references public.boat_tours (id) on delete cascade,
  is_featured boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (company_id, boat_tour_id)
);

comment on table public.company_boat_features is
  'Which admin-owned boat tours a company features, and in what order (PRD §7.5). Company can toggle/reorder, never edit the underlying tour.';

-- ---------------------------------------------------------------------------
-- recommendations
-- ---------------------------------------------------------------------------
-- Both the company "base list" and a guide's personal additions live here,
-- distinguished by owner_type/guide_id (PRD §12's owner_type/owner_id,
-- concretised into real FKs instead of a polymorphic owner_id).
--   owner_type = 'company', guide_id = null   -> base list item
--   owner_type = 'guide',   guide_id = <g>    -> that guide's personal item
-- A guide's Studio view reads: base list (read-only) UNION own items
-- (read/write). See RLS in the next migration.
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  owner_type public.recommendation_owner_type not null,
  guide_id uuid references public.guides (id) on delete cascade,

  category public.category_id not null,
  name text not null,
  -- Neighbourhood / nearest landmark, shown as the card subtitle prefix.
  area text not null,
  address text not null,
  lng double precision not null,
  lat double precision not null,

  -- The guide's personal endorsement. Required, ~280 chars per PRD §6.3.
  -- This — not a star rating — is the product's entire trust signal.
  note text not null check (char_length(note) > 0),

  -- Guide-entered free text, e.g. "Tue–Sun 11:00–18:00, closed Mondays".
  -- There is no structured opening-hours model and none is planned —
  -- Google's structured hours are not available without the Places API.
  hours text not null default '',

  -- Guide-uploaded, multiple, swipeable; first is the card thumbnail.
  -- Rendered by the existing PhotoGallery component.
  photos text[] not null default '{}',

  visible boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recommendation_owner_shape check (
    (owner_type = 'company' and guide_id is null)
    or (owner_type = 'guide' and guide_id is not null)
  ),
  -- Boats are a separate table/pin-category, never a recommendation row —
  -- see the file header. This is the enforcement point.
  constraint recommendation_category_not_boats check (category <> 'boats')
);

comment on table public.recommendations is
  'Company base-list items (owner_type=company) and guide personal add-ons (owner_type=guide), same table, split by owner (PRD §12, simplified from a polymorphic owner_id to real FKs). No rating column, ever.';
comment on column public.recommendations.note is
  'The guide''s personal note. This is the endorsement — the product has no star ratings or review counts anywhere, by deliberate design.';

create or replace function public.recommendation_guide_company_matches()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.guide_id is not null then
    if not exists (
      select 1 from public.guides g
      where g.id = new.guide_id and g.company_id = new.company_id
    ) then
      raise exception 'recommendations.company_id must match guides.company_id for guide_id %', new.guide_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger recommendations_guide_company_matches
  before insert or update on public.recommendations
  for each row execute function public.recommendation_guide_company_matches();

-- ---------------------------------------------------------------------------
-- guest_sessions
-- ---------------------------------------------------------------------------
-- The guest app is unauthenticated and saves tips to localStorage only
-- (PRD §5.4 "Persistence: localStorage, no login"). This table is scaffolding
-- for the "post-MVP cross-device sync" line in that same section — nothing
-- writes to it yet. See src/lib/data/source.ts for the TODO marking exactly
-- where a future sync call would go.
create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  guide_id uuid references public.guides (id) on delete set null,
  saved_recommendation_ids uuid[] not null default '{}',
  saved_boat_tour_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.guest_sessions is
  'Server-side mirror for future cross-device save-sync (PRD §5.4, post-MVP). Not written to in v1 — guest saves are localStorage-only. No client RLS policy is defined until this ships (see next migration).';

-- ---------------------------------------------------------------------------
-- events (analytics)
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_type public.event_type not null,
  company_id uuid references public.companies (id) on delete cascade,
  guide_id uuid references public.guides (id) on delete set null,
  boat_tour_id uuid references public.boat_tours (id) on delete set null,
  recommendation_id uuid references public.recommendations (id) on delete set null,
  guest_session_id uuid references public.guest_sessions (id) on delete set null,
  platform public.event_platform not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

comment on table public.events is
  'Analytics events (PRD §10). Written by the guest app (anon, insert-only) and read back scoped by role: admin=all, company=own+guides, guide=own only.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index guides_company_id_idx on public.guides (company_id);
create index profiles_company_id_idx on public.profiles (company_id);
create index profiles_guide_id_idx on public.profiles (guide_id);
create index company_boat_features_boat_tour_id_idx on public.company_boat_features (boat_tour_id);
create index recommendations_company_id_idx on public.recommendations (company_id);
create index recommendations_guide_id_idx on public.recommendations (guide_id);
create index recommendations_category_idx on public.recommendations (category);
create index guest_sessions_company_id_idx on public.guest_sessions (company_id);
create index events_company_id_occurred_at_idx on public.events (company_id, occurred_at desc);
create index events_guide_id_occurred_at_idx on public.events (guide_id, occurred_at desc);
create index events_event_type_idx on public.events (event_type);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger guides_set_updated_at before update on public.guides
  for each row execute function public.set_updated_at();
create trigger boat_tours_set_updated_at before update on public.boat_tours
  for each row execute function public.set_updated_at();
create trigger recommendations_set_updated_at before update on public.recommendations
  for each row execute function public.set_updated_at();
