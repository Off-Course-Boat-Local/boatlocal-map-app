-- Boat Local Map App — local dev seed
--
-- Mirrors the shape of the fake data in src/lib/data.ts and src/lib/brand.ts
-- exactly (one guide "Jan", 14 places, 6 boat tours) so the schema is
-- provably consistent with what the guest app spike already renders.
-- Loaded automatically by `supabase db reset` (see [db.seed] in
-- supabase/config.toml).
--
-- Deliberately NOT seeded: `profiles`. That table is 1:1 with
-- `auth.users`, and this repo has no real Supabase Auth wired up yet (see
-- the DEV AUTH STAND-IN module) — fabricating auth.users rows here would be
-- exactly the "fake working DB connection" the project rules say not to do.
-- Once real Supabase Auth exists, a profile row is created by the sign-up
-- flow, not by this seed file.

begin;

-- ---------------------------------------------------------------------------
-- One tenant, matching src/lib/brand.ts BRANDS.coastal (the DEFAULT_BRAND
-- used by the guest spike today) and src/lib/data.ts GUIDE ("Jan").
-- ---------------------------------------------------------------------------
insert into public.companies (
  id, name, company_type, app_name,
  brand_primary, brand_primary_dark, brand_accent, brand_surround,
  campaign_params, google_review_url, tripadvisor_review_url, status
) values (
  '11111111-1111-1111-1111-111111111111',
  'Boat & Bike Co.',
  'host',
  'Jan''s Amsterdam',
  '#2B4FE0', '#1D37A8', '#6E8CFF', '#E8E6DF',
  'utm_source=boatlocal&utm_medium=studio',
  'https://g.page/r/example-boat-and-bike/review',
  null,
  'active'
);

insert into public.guides (
  id, company_id, name, email, slug, avatar_initial, welcome_message, status
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Jan',
  'jan@example.com',
  'jan',
  'J',
  'Welcome to my favourite city! I''ve collected the best spots just for you.',
  'active'
);

-- ---------------------------------------------------------------------------
-- Boat tours — admin-owned catalog, never tenant-scoped. Matches
-- src/lib/data.ts BOAT_TOURS 1:1, including `position` order.
-- ---------------------------------------------------------------------------
insert into public.boat_tours (id, name, area, lng, lat, meta, note, booking_url, photos, position, status)
values
  ('33333333-3333-3333-3333-333333333301', 'Sunset Canal Cruise', 'Central Station', 4.9003, 52.3791,
   '90 min · €28 pp · drinks incl.', 'My absolute favourite — book for golden hour.',
   'https://boatlocal.nl/tours/sunset-canal-cruise',
   array['https://picsum.photos/seed/sunset0/800/600','https://picsum.photos/seed/sunset1/800/600','https://picsum.photos/seed/sunset2/800/600'],
   1, 'active'),
  ('33333333-3333-3333-3333-333333333302', 'Morning Gracht Tour', 'Anne Frank area', 4.8837, 52.3766,
   '60 min · €22 pp · quiet canals', 'Before the crowds. The canals are glass at 9am.',
   'https://boatlocal.nl/tours/morning-gracht',
   array['https://picsum.photos/seed/morning0/800/600','https://picsum.photos/seed/morning1/800/600','https://picsum.photos/seed/morning2/800/600'],
   2, 'active'),
  ('33333333-3333-3333-3333-333333333303', 'Private Charter', 'Prinsengracht', 4.8829, 52.3695,
   '2 hrs · from €180 · up to 8 guests', 'Worth splitting with a group. Bring your own snacks.',
   'https://boatlocal.nl/tours/private-charter',
   array['https://picsum.photos/seed/charter0/800/600','https://picsum.photos/seed/charter1/800/600','https://picsum.photos/seed/charter2/800/600'],
   3, 'active'),
  ('33333333-3333-3333-3333-333333333304', 'Pizza Boat', 'Westerdok', 4.8912, 52.3856,
   '2 hrs · €45 pp · dinner cruise', 'Sounds like a gimmick. Is not a gimmick.',
   'https://boatlocal.nl/tours/pizza-boat',
   array['https://picsum.photos/seed/pizza0/800/600','https://picsum.photos/seed/pizza1/800/600','https://picsum.photos/seed/pizza2/800/600'],
   4, 'active'),
  ('33333333-3333-3333-3333-333333333305', 'Self-Drive Boat Rental', 'Prinsengracht', 4.8867, 52.3648,
   'From €90 / 2 hrs · no licence needed', 'Easier than it looks. Stay right, mind the tour boats.',
   'https://boatlocal.nl/tours/self-drive',
   array['https://picsum.photos/seed/selfdrive0/800/600','https://picsum.photos/seed/selfdrive1/800/600','https://picsum.photos/seed/selfdrive2/800/600'],
   5, 'active'),
  ('33333333-3333-3333-3333-333333333306', 'Evening Lights Cruise', 'Centraal', 4.8978, 52.3776,
   '75 min · €26 pp · covered boat', 'The bridges are lit up. Good one for a rainy night.',
   'https://boatlocal.nl/tours/evening-lights',
   array['https://picsum.photos/seed/lights0/800/600','https://picsum.photos/seed/lights1/800/600','https://picsum.photos/seed/lights2/800/600'],
   6, 'active');

-- This tenant features all six admin tours, in catalog order.
insert into public.company_boat_features (company_id, boat_tour_id, is_featured, position)
select '11111111-1111-1111-1111-111111111111', id, true, position
from public.boat_tours;

-- ---------------------------------------------------------------------------
-- Recommendations — matches src/lib/data.ts PLACES 1:1 (14 rows). Split
-- across owner_type so the seed also demonstrates the base-list-vs-personal
-- model: most are the company's base list; a few are Jan's own personal
-- additions layered on top, same as a guide would add in Studio. The guest
-- app renders all of them identically (visible=true) — owner_type only
-- matters for who may edit which row in Studio.
-- ---------------------------------------------------------------------------
insert into public.recommendations (
  id, company_id, owner_type, guide_id, categories, name, area, address, lng, lat, note, hours, photos, visible
) values
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['breakfast'], 'Bakers & Roasters', 'De Pijp', 'Eerste Jacob van Campenstraat 54', 4.8917, 52.3556,
   'Best pancakes in the city. Go before 9 or you''ll queue for an hour.', 'Daily 08:30–16:00',
   array['https://picsum.photos/seed/bakers0/800/600','https://picsum.photos/seed/bakers1/800/600','https://picsum.photos/seed/bakers2/800/600'], true),

  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', 'guide', '22222222-2222-2222-2222-222222222222',
   array['breakfast'], 'Mook Pancakes', 'Centrum', 'Vondelstraat 24', 4.8807, 52.3639,
   'Dutch pancakes done properly. The apple one is the move.', 'Daily 09:00–17:00',
   array['https://picsum.photos/seed/mook0/800/600','https://picsum.photos/seed/mook1/800/600','https://picsum.photos/seed/mook2/800/600'], true),

  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['lunch'], 'Café de Jaren', 'Centrum', 'Nieuwe Doelenstraat 20', 4.8956, 52.3676,
   'Sit on the terrace over the Amstel. Worth it for the view alone.', 'Daily 10:00–01:00',
   array['https://picsum.photos/seed/jaren0/800/600','https://picsum.photos/seed/jaren1/800/600','https://picsum.photos/seed/jaren2/800/600'], true),

  ('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111111', 'guide', '22222222-2222-2222-2222-222222222222',
   array['lunch'], 'Pendergast', 'Jordaan', 'Tweede Egelantiersdwarsstraat 6', 4.8815, 52.3745,
   'Great sandwiches, no fuss. Where I actually eat on my day off.', 'Tue–Sun 11:00–18:00, closed Mondays',
   array['https://picsum.photos/seed/pender0/800/600','https://picsum.photos/seed/pender1/800/600','https://picsum.photos/seed/pender2/800/600'], true),

  ('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['lunch'], 'Foodhallen', 'Oud-West', 'Bellamyplein 51', 4.869, 52.3661,
   'Old tram depot, twenty food stalls. Good when nobody can agree.', 'Sun–Thu 11:00–23:30, Fri–Sat till 01:00',
   array['https://picsum.photos/seed/foodhal0/800/600','https://picsum.photos/seed/foodhal1/800/600','https://picsum.photos/seed/foodhal2/800/600'], true),

  ('44444444-4444-4444-4444-444444444406', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['coffee'], 'Lot Sixty One', 'Oud-West', 'Kinkerstraat 112', 4.8703, 52.3648,
   'They roast their own. Small place, take it away and walk.', 'Mon–Fri 08:00–17:00, weekends from 09:00',
   array['https://picsum.photos/seed/lot610/800/600','https://picsum.photos/seed/lot611/800/600','https://picsum.photos/seed/lot612/800/600'], true),

  ('44444444-4444-4444-4444-444444444407', '11111111-1111-1111-1111-111111111111', 'guide', '22222222-2222-2222-2222-222222222222',
   array['coffee'], 'Screaming Beans', 'Nine Streets', 'Hartenstraat 12', 4.8853, 52.3719,
   'Tiny, always busy, best flat white in the Nine Streets.', 'Daily 08:00–18:00',
   array['https://picsum.photos/seed/beans0/800/600','https://picsum.photos/seed/beans1/800/600','https://picsum.photos/seed/beans2/800/600'], true),

  ('44444444-4444-4444-4444-444444444408', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['drinks'], 'Brouwerij ''t IJ', 'Oost', 'Funenkade 7', 4.9265, 52.3667,
   'Brewery under a windmill. Sit outside, order the Zatte.', 'Daily 14:00–20:00',
   array['https://picsum.photos/seed/brouwerij0/800/600','https://picsum.photos/seed/brouwerij1/800/600','https://picsum.photos/seed/brouwerij2/800/600'], true),

  ('44444444-4444-4444-4444-444444444409', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['drinks'], 'Café Papeneiland', 'Jordaan', 'Prinsengracht 2', 4.8846, 52.3799,
   'A proper brown café from 1642. Order a jenever, don''t rush it.', 'Daily 10:00–01:00',
   array['https://picsum.photos/seed/papen0/800/600','https://picsum.photos/seed/papen1/800/600','https://picsum.photos/seed/papen2/800/600'], true),

  ('44444444-4444-4444-4444-444444444410', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['see'], 'Rijksmuseum', 'Museumkwartier', 'Museumstraat 1', 4.8852, 52.36,
   'Book online first. Go straight to the Night Watch, then wander back.', 'Daily 09:00–17:00',
   array['https://picsum.photos/seed/rijks0/800/600','https://picsum.photos/seed/rijks1/800/600','https://picsum.photos/seed/rijks2/800/600'], true),

  ('44444444-4444-4444-4444-444444444411', '11111111-1111-1111-1111-111111111111', 'guide', '22222222-2222-2222-2222-222222222222',
   array['see'], 'Anne Frank House', 'Jordaan', 'Westermarkt 20', 4.884, 52.3752,
   'Tickets sell out weeks ahead — book before you land, not here.', 'Daily 09:00–22:00',
   array['https://picsum.photos/seed/anne0/800/600','https://picsum.photos/seed/anne1/800/600','https://picsum.photos/seed/anne2/800/600'], true),

  ('44444444-4444-4444-4444-444444444412', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['photo'], 'NDSM Werf', 'Noord', 'NDSM-plein 1', 4.8927, 52.4013,
   'Free ferry from Centraal. Street art everywhere, best light at sunset.', 'Always open',
   array['https://picsum.photos/seed/ndsm0/800/600','https://picsum.photos/seed/ndsm1/800/600','https://picsum.photos/seed/ndsm2/800/600'], true),

  ('44444444-4444-4444-4444-444444444413', '11111111-1111-1111-1111-111111111111', 'company', null,
   array['shop'], 'De 9 Straatjes', 'Centrum', 'Reestraat / Hartenstraat', 4.8846, 52.3712,
   'Nine little streets of small shops. Just walk them, don''t plan it.', 'Most shops 10:00–18:00',
   array['https://picsum.photos/seed/negen0/800/600','https://picsum.photos/seed/negen1/800/600','https://picsum.photos/seed/negen2/800/600'], true),

  ('44444444-4444-4444-4444-444444444414', '11111111-1111-1111-1111-111111111111', 'guide', '22222222-2222-2222-2222-222222222222',
   array['shop'], 'Waterlooplein Market', 'Centrum', 'Waterlooplein', 4.9028, 52.3676,
   'Flea market. Come early for the good stuff, haggle a little.', 'Mon–Sat 09:00–17:00, closed Sunday',
   array['https://picsum.photos/seed/waterloo0/800/600','https://picsum.photos/seed/waterloo1/800/600','https://picsum.photos/seed/waterloo2/800/600'], true);

commit;
