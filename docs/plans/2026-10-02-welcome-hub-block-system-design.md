# Welcome Hub Block System Design

> **Document:** Design Document for the Dynamic Welcome Hub Block System  
> **Date:** 2026-10-02  
> **Status:** Approved  
> **Reference:** `/Users/beer/Developer/boatlocal/docs/block-system-editor-guide.md`

---

## 1. Context & Motivation

Tour operators like **FreeDam Tours** (e.g. `https://freedamtours.com/sergio/`) currently send guests to static post-tour WordPress pages. While these pages contain rich recommendations (TripAdvisor review links, partner discounts like 10% off at Bistro Berlage, multiple Google Maps links, favorite brown cafes, and "What to avoid"), they suffer from critical limitations:
- **Disjointed experience:** Clicking a link leaves the site and opens an external Google Maps page; the tour operator's branding disappears immediately.
- **Static & unmaintained:** Pricing, photos, and ratings go stale silently.
- **One-off & non-interactive:** Guests cannot filter by proximity, search, save favorites, or view interactive walking directions.

The Map App solves this by turning the post-tour welcome screen into a **permanent, interactive Welcome Hub (Home Tab)**. Furthermore, to accommodate varying company styles and individual guide voices (e.g., Sergio vs. Alexander), the Welcome Hub is constructed using a **typed Block System** ported directly from BoatLocal's proven architecture (`docs/block-system-editor-guide.md`).

---

## 2. Navigational Architecture

The guest experience shifts from a disposable splash screen to a persistent 5-tab navigation:

1. **Home (`/`)**: The Welcome Hub with guide greeting, review widget, category shortcuts, partner perks/discounts, and curated tips.
2. **Map (`/map`)**: Full interactive MapLibre map with all pins, routes, and boat departures.
3. **List (`/list`)**: Filterable, searchable list of all places.
4. **Saved (`/saved`)**: Favorites saved with local badge counter.
5. **Install (`/install`)**: PWA install instructions.

*Note on `/review`:* The review actions (TripAdvisor, Google Reviews, GuruWalk) are embedded directly into the Home tab as an interactive widget right when guests are most engaged, freeing up a bottom nav tab slot for `Home`.

---

## 3. Data Model & Inheritance Architecture

### 3.1 Relational Schema

```sql
-- Eén welkomst-hub per company-default (guide_id IS NULL)
-- OF per individuele gids-override (guide_id IS NOT NULL)
CREATE TABLE welcome_hubs (
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

CREATE INDEX idx_welcome_hubs_lookup ON welcome_hubs(company_id, guide_id);

-- Geordende blocks per hub
CREATE TABLE welcome_blocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id        uuid NOT NULL REFERENCES welcome_hubs(id) ON DELETE CASCADE,
  block_type    text NOT NULL,
  display_order int4 NOT NULL DEFAULT 0,
  content       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_welcome_blocks_hub ON welcome_blocks(hub_id, display_order);
```

### 3.2 Inheritance & Overname Flow
1. **Company Admin**: Configures the default template (`guide_id = null`) in Studio.
2. **Guide**:
   - By default, falls back to the company template if no guide hub exists.
   - Guide or Admin can click **"Maak eigen gids-versie"**, which clones the company's blocks into a guide-specific hub (`guide_id = guide.id`).
   - Guide can click **"Reset naar company template"** to discard overrides.
3. **Resolution at runtime**:
   - `getWelcomeHub(companyId, guideId)`: Checks for `guide_id` first. If present and has active blocks, returns guide blocks. Otherwise, returns company default blocks. If neither exists, falls back to sensible default generated blocks based on the company's recommendations and reviews.

---

## 4. Block Catalog & Types

Every block conforms to a discriminated union `WelcomeBlock`:

```ts
export type WelcomeBlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'quote'
  | 'faq_group'
  | 'guide_hero'
  | 'review_card'
  | 'category_shortcuts'
  | 'featured_places'
  | 'boat_tour_card'
  | 'tip_box'
  | 'cta_banner';
```

### Block Definitions:

1. **`guide_hero`**: Avatar, guide name, personal quote/greeting, and thank-you text.
2. **`review_card`**: 5-star rating prompt with direct deep-links to TripAdvisor, Google Reviews, and GuruWalk.
3. **`category_shortcuts`**: Visual category tiles (*Lunch, Diner, Bruine Kroegen, Vegan*) displaying pin counts and deep-linking directly to `/map?category=...` or `/list?category=...`.
4. **`featured_places`**: Curated place cards with optional badge (e.g. *"10% Gids Korting"*, *"Gids Favoriet"*), tapping opens place detail and walking directions.
5. **`boat_tour_card`**: BoatLocal canal cruise card with live booking trigger.
6. **`tip_box`**: Highlighted card with icon for *"What to avoid"* or *"Insider Secret"* (e.g. free NDSM ferry tips, overpriced stroopwafel warnings).
7. **`heading` & `paragraph`**: Rich text blocks sanitized server-side.
8. **`faq_group`**: Accordion FAQ items (e.g. transit, tips, bathrooms).
9. **`cta_banner`**: Action button (e.g. link to book other tours).

---

## 5. Studio Editor Experience

Located at `/studio/welcome-hub` (for Company Admins) and accessible per guide:

1. **WYSIWYG Live Rendering**: Blocks render using the actual guest-facing components inside a responsive mobile frame.
2. **Notion-Style Controls**:
   - Hover gutter with `+` insert button opening the visual Block Registry gallery.
   - Drag handles (`⋮⋮`) for reordering (`@dnd-kit`).
   - Delete icon per block.
3. **Atomic Save**:
   - Single "Save Blocks" button.
   - Replaces the full block set for the hub (`display_order = index`), eliminating state drift and partial-update bugs.
   - Dirty-state tracking.
4. **Template Clone / Reset**:
   - "Copy from Company Template" button for guides.

---

## 6. Public Guest Renderer

Located at `src/app/(guest)/page.tsx` & `src/components/guest/GuestHomeScreen.tsx`:
- Server-rendered for fast initial load.
- Resolves all place IDs, boat tours, and review links in a single batched query before rendering.
- Unknown or corrupted block types render `null` gracefully without crashing the page.
- Deep links seamlessly to `/map` and `/list` with pre-applied category filters.

---

## 7. Editorial Rules (from Section 10 of guide)

- **Core test:** Every block must answer an active post-tour question (e.g., where to eat now, where to review, what to avoid).
- **Lead-in sentences:** No interactive blocks dropped cold; always framed with context.
- **Data references by ID:** Places and boat tours stored as IDs, never copied values.
- **Alt text ≠ Caption:** Real descriptions in alt, new contextual insight in captions.
