-- Structured duration/price columns for BoatLocal-synced tours. The
-- catalogue feed (`GET /api/public/cruises`) has always supplied
-- `cruise_duration` ("1 hour & 30 mins"), `starting_price` (29, 22.5) and
-- `currency` ("EUR") per cruise, but until now they only survived into the
-- composed free-text `meta` line ("1 hour & 30 mins · from €29 pp") — which
-- the guest UI can only ever show whole. Storing the pieces separately lets
-- a later guest-UI pass render a short price-only footer ("from €29 pp") and
-- put the duration on its own meta row, without parsing the display string
-- back apart.
--
-- `meta` itself is NOT going anywhere: it remains the composed display
-- fallback, still rewritten by every sync exactly as before, and still the
-- one guest-facing line an admin-curated tour has (BoatTourForm has no
-- structured price entry — see src/lib/admin/boatTourForm.ts's own note).
--
-- All three are BoatLocal-owned, like name/photos/booking_url: rewritten on
-- EVERY sync (a price change on BoatLocal's side propagates on the next
-- sync), never admin-edited. Nullable like every other BoatLocal column on
-- this table: admin-curated tours (fareharbor_pk is null) never get them,
-- and BoatLocal-sourced rows synced before these columns existed hold null
-- until their next sync.
--
-- starting_price_cents is an INTEGER cent amount, not numeric euros: the
-- feed's `starting_price` is a JSON number (22.5), and round-tripping that
-- through a float/numeric column invites drift ("22.50" vs "22.499999...").
-- syncCruiseFromBoatLocal converts once with Math.round(price * 100) and
-- everything downstream does exact integer arithmetic — the same convention
-- the booking webhook's amountCents already uses (see events.metadata).
alter table public.boat_tours
  add column cruise_duration text,
  add column starting_price_cents integer,
  add column price_currency text;

comment on column public.boat_tours.cruise_duration is
  'BoatLocal''s own duration text for this cruise ("1 hour & 30 mins"), verbatim from the catalogue feed, rewritten on every sync. Null for admin-curated tours and for BoatLocal rows not yet re-synced since this column shipped. `meta` remains the composed display fallback; see syncCruiseFromBoatLocal in src/lib/data/source.ts.';

comment on column public.boat_tours.starting_price_cents is
  'BoatLocal''s from-price for this cruise in integer cents (feed sends 22.5 -> stored 2250), rewritten on every sync. Cents rather than a numeric euro amount so downstream formatting is exact integer math, never float drift. Null for admin-curated tours and for BoatLocal rows not yet re-synced since this column shipped.';

comment on column public.boat_tours.price_currency is
  'ISO currency code for starting_price_cents ("EUR"), verbatim from BoatLocal''s feed, rewritten on every sync. Null for admin-curated tours, for BoatLocal rows not yet re-synced since this column shipped, and whenever the feed omits it alongside a price (formatters should fall back to EUR, matching formatCruiseMeta).';
