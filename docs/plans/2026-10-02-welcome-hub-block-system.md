# Welcome Hub Block System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dynamic, block-based Welcome Hub (Home Tab) in the Map App ported from BoatLocal's Block System architecture, allowing tour operators and guides (like FreeDam Tours' Sergio) to create custom post-tour experiences with review prompts, category map shortcuts, featured deals, and insider tips.

**Architecture:** Database-backed block storage (`welcome_hubs` and `welcome_blocks`) with company-to-guide inheritance. A public batched block renderer powering the permanent `Home` tab on `/`, coupled with a WYSIWYG block editor in Studio for company admins and guides.

**Tech Stack:** Next.js 16 (App Router, Server Components & Server Actions), TypeScript, Supabase / PostgreSQL (RLS), Tailwind CSS, Lucide icons, `@dnd-kit` (drag & drop reordering), Vitest for unit & integration testing.

---

### Task 1: Database Migration for Welcome Hubs & Blocks

**Files:**
- Create: `supabase/migrations/20261002160000_welcome_hubs_and_blocks.sql`
- Test: CLI migration verification script

**Step 1: Write the migration file**
Create the `welcome_hubs` and `welcome_blocks` tables, indexes, unique constraints, and RLS policies ensuring public read access and authenticated admin/company write access.

```sql
CREATE TABLE IF NOT EXISTS welcome_hubs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  guide_id     uuid REFERENCES guides(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT '',
  intro        text NOT NULL DEFAULT '',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT unique_company_guide_hub UNIQUE (company_id, guide_id)
);

CREATE INDEX IF NOT EXISTS idx_welcome_hubs_lookup ON welcome_hubs(company_id, guide_id);

CREATE TABLE IF NOT EXISTS welcome_blocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id        uuid NOT NULL REFERENCES welcome_hubs(id) ON DELETE CASCADE,
  block_type    text NOT NULL,
  display_order int4 NOT NULL DEFAULT 0,
  content       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welcome_blocks_hub ON welcome_blocks(hub_id, display_order);

ALTER TABLE welcome_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_welcome_hubs" ON welcome_hubs FOR SELECT USING (true);
CREATE POLICY "public_read_welcome_blocks" ON welcome_blocks FOR SELECT USING (true);

CREATE POLICY "admin_company_manage_welcome_hubs" ON welcome_hubs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.company_id = welcome_hubs.company_id)
    )
  );

CREATE POLICY "admin_company_manage_welcome_blocks" ON welcome_blocks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM welcome_hubs
      JOIN profiles ON (profiles.role = 'admin' OR profiles.company_id = welcome_hubs.company_id)
      WHERE welcome_hubs.id = welcome_blocks.hub_id AND profiles.id = auth.uid()
    )
  );
```

**Step 2: Apply migration to Supabase**
Run: `npx supabase db push` or execute via admin client if remote.
Expected: Tables created successfully.

**Step 3: Commit migration**
```bash
git add supabase/migrations/20261002160000_welcome_hubs_and_blocks.sql
git commit -m "feat(db): add welcome_hubs and welcome_blocks schema"
```

---

### Task 2: TypeScript Types & Block Registry

**Files:**
- Create: `src/types/welcome-blocks.ts`
- Create: `src/lib/welcome-blocks/registry.ts`
- Test: `src/lib/welcome-blocks/registry.test.ts`

**Step 1: Write failing test for Block Registry**
Test that each registered block type provides valid default content, a label, and an icon.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/lib/welcome-blocks/registry.test.ts`
Expected: FAIL (modules do not exist).

**Step 3: Implement TypeScript discriminated unions & Registry**
Implement `WelcomeBlock`, `WelcomeBlockType`, and the `BLOCK_REGISTRY` entries:
- `guide_hero`: `{ title?: string; greeting?: string; showAvatar?: boolean }`
- `review_card`: `{ promptText?: string; platforms: Array<'tripadvisor' | 'google' | 'guruwalk'> }`
- `category_shortcuts`: `{ categoryKeys: string[] }`
- `featured_places`: `{ placeIds: string[]; showDiscountBadge?: boolean }`
- `boat_tour_card`: `{ tourId?: string; headline?: string }`
- `tip_box`: `{ title: string; body: string; style: 'tip' | 'warning' }`
- `heading`: `{ text: string; level: 2 | 3 }`
- `paragraph`: `{ text: string }`
- `image`: `{ url: string; alt: string; caption?: string }`
- `faq_group`: `{ items: Array<{ question: string; answer: string }> }`
- `cta_banner`: `{ label: string; href: string }`

**Step 4: Run test to verify it passes**
Run: `npm test -- src/lib/welcome-blocks/registry.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/types/welcome-blocks.ts src/lib/welcome-blocks/
git commit -m "feat: define welcome block types and registry"
```

---

### Task 3: Data Access Layer for Welcome Hubs

**Files:**
- Create: `src/lib/data/welcomeHub.ts`
- Test: `src/lib/data/welcomeHub.test.ts`

**Step 1: Write failing unit test for `getWelcomeHub` & `saveWelcomeHubBlocks`**
Test company fallback, guide override resolution, and block ordering.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/lib/data/welcomeHub.test.ts`
Expected: FAIL.

**Step 3: Implement data access functions in `welcomeHub.ts`**
- `getWelcomeHubBlocks(companyId: string, guideId?: string | null)`:
  Resolves guide-specific blocks if present; otherwise company default blocks; falls back to auto-generated default blocks from company profile if none exist.
- `saveWelcomeHubBlocks(actor, companyId, guideId, blocks)`:
  Atomic upsert of hub and full replacement of blocks (`display_order = index`).
- `cloneCompanyHubToGuide(actor, companyId, guideId)`:
  Copies all company default blocks into a new guide hub.
- `resetGuideHubToCompany(actor, companyId, guideId)`:
  Deletes the guide hub row so it falls back to company default.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/lib/data/welcomeHub.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/data/welcomeHub.ts src/lib/data/welcomeHub.test.ts
git commit -m "feat: add welcome hub data access layer and tests"
```

---

### Task 4: Welcome Block View Components & Renderer

**Files:**
- Create: `src/components/welcome-blocks/GuideHeroBlock.tsx`
- Create: `src/components/welcome-blocks/ReviewCardBlock.tsx`
- Create: `src/components/welcome-blocks/CategoryShortcutsBlock.tsx`
- Create: `src/components/welcome-blocks/FeaturedPlacesBlock.tsx`
- Create: `src/components/welcome-blocks/BoatTourCardBlock.tsx`
- Create: `src/components/welcome-blocks/TipBoxBlock.tsx`
- Create: `src/components/welcome-blocks/WelcomeBlockRenderer.tsx`
- Test: `src/components/welcome-blocks/WelcomeBlockRenderer.test.tsx`

**Step 1: Write failing test for `WelcomeBlockRenderer`**
Verify that all block types render their respective UI components and gracefully render `null` on unknown block types.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/components/welcome-blocks/WelcomeBlockRenderer.test.tsx`
Expected: FAIL.

**Step 3: Implement components**
Build responsive, accessible Tailwind components matching the Map App aesthetic:
- `GuideHeroBlock`: Renders guide avatar, name, and warm post-tour greeting.
- `ReviewCardBlock`: 5-star header with direct external links to TripAdvisor, Google, and GuruWalk.
- `CategoryShortcutsBlock`: Interactive category chips (Lunch, Diner, Bruine Kroegen, Vegan) linking to `/map?category=...` and `/list?category=...`.
- `FeaturedPlacesBlock`: Cards for places like Bistro Berlage with discount badges, opening place modal on map.
- `BoatTourCardBlock`: BoatLocal tour card with booking CTA.
- `TipBoxBlock`: Accent box for "Wat te vermijden" or insider secrets.
- `WelcomeBlockRenderer`: Loops through sorted blocks and renders each with batched props (resolved places, brand tokens, guide context).

**Step 4: Run test to verify it passes**
Run: `npm test -- src/components/welcome-blocks/WelcomeBlockRenderer.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/welcome-blocks/
git commit -m "feat: implement welcome block components and renderer"
```

---

### Task 5: Persistent Home Tab in Bottom Navigation & Public Route

**Files:**
- Modify: `src/components/guest/GuestBottomNav.tsx`
- Modify: `src/app/(guest)/page.tsx`
- Test: `src/components/guest/GuestBottomNav.test.tsx`

**Step 1: Write failing test for `GuestBottomNav`**
Test that `Home` (`/`) is the active first tab on root and persists query parameters (`company` and `guide`).

**Step 2: Run test to verify it fails**
Run: `npm test -- src/components/guest/GuestBottomNav.test.tsx`
Expected: FAIL.

**Step 3: Update `GuestBottomNav.tsx` and `WelcomePage` (`src/app/(guest)/page.tsx`)**
- In `GuestBottomNav.tsx`: Set `NAV_ITEMS` to `[Home (/), Map (/map), List (/list), Saved (/saved), Install (/install)]`.
- In `src/app/(guest)/page.tsx`: Fetch welcome hub blocks via `getWelcomeHubBlocks(companyId, guide?.id)`. Render `WelcomeBlockRenderer` alongside the existing PWA install prompt.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/components/guest/GuestBottomNav.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/guest/GuestBottomNav.tsx src/app/\(guest\)/page.tsx
git commit -m "feat: wire persistent Home tab in guest navigation and root page"
```

---

### Task 6: Studio WYSIWYG Block Editor

**Files:**
- Create: `src/lib/studio/welcomeHubActions.ts` (Server Actions for save, clone, reset)
- Create: `src/components/studio/WelcomeHubEditor.tsx` (Interactive editor with drag-and-drop & block picker)
- Create: `src/app/studio/(protected)/welcome-hub/page.tsx`
- Test: `src/lib/studio/welcomeHubActions.test.ts`

**Step 1: Write failing test for Server Actions**
Test `saveWelcomeHubAction` and permission verification.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/lib/studio/welcomeHubActions.test.ts`
Expected: FAIL.

**Step 3: Implement Editor & Actions**
- Server Actions enforcing `requireCompanyRole()`.
- Studio page with guide selector dropdown, allowing editing of either the Company Default or specific Guide Hubs.
- "Kopieer van Company Template" button for guides.
- Notion-style inline block editing with `@dnd-kit` drag handles, `+` add block modal, delete button, and single dirty-aware "Save Blocks" button.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/lib/studio/welcomeHubActions.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/studio/welcomeHubActions.ts src/components/studio/WelcomeHubEditor.tsx src/app/studio/\(protected\)/welcome-hub/
git commit -m "feat: add Studio Welcome Hub WYSIWYG editor and actions"
```

---

### Task 7: End-to-End Verification & FreeDam Tours Sergio Demo Setup

**Files:**
- Create: `scripts/seed-freedam-sergio-hub.mjs`
- Test: Verify full guest flow from Home (`/`) to Map (`/map`) and Studio editor.

**Step 1: Write seed script for FreeDam Tours Sergio Welcome Hub**
Populate FreeDam Tours with Sergio's exact blocks:
- Guide hero: Sergio's thank you message
- Review card: TripAdvisor, Google Reviews, GuruWalk
- Category shortcuts: Lunch, Diner, Vegan, Bruine Kroegen, Nightlife
- Featured place: Bistro Berlage (with 10% discount badge), Café 't Smalle
- Boat tour card: BoatLocal canal cruise
- Tip box: Free NDSM ferry instructions & What to avoid (overpriced stroopwafels)

**Step 2: Run seed script and test navigation**
Run: `node scripts/seed-freedam-sergio-hub.mjs`
Expected: Success.

**Step 3: Run full test suite & build check**
Run: `npm test && npm run build`
Expected: All tests pass, Next.js build succeeds with 0 errors.

**Step 4: Commit**
```bash
git add scripts/seed-freedam-sergio-hub.mjs
git commit -m "feat: add FreeDam Tours Sergio demo hub and verify build"
```
