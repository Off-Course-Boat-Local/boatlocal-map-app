export const WELCOME_BLOCK_TYPES = [
  "guide_hero",
  "review_card",
  "category_shortcuts",
  "featured_places",
  "boat_tour_card",
  "tip_box",
  "heading",
  "paragraph",
  "image",
  "quote",
  "faq_group",
  "cta_banner",
] as const;

export type WelcomeBlockType = (typeof WELCOME_BLOCK_TYPES)[number];

export type ReviewPlatform = "tripadvisor" | "google" | "guruwalk";

export interface GuideHeroContent {
  title?: string;
  greeting?: string;
  showAvatar?: boolean;
  /** Large photo of the guide shown at the top of the hero (https URL). */
  photoUrl?: string;
}

export interface ReviewCardContent {
  promptText?: string;
  platforms: ReviewPlatform[];
  /** Per-platform review links (https only). Platforms without a URL are not shown to guests. */
  urls?: Partial<Record<ReviewPlatform, string>>;
}

export interface CategoryShortcutsContent {
  categoryKeys: string[];
}

export interface FeaturedPlacesContent {
  placeIds: string[];
  showDiscountBadge?: boolean;
}

export interface BoatTourCardContent {
  tourId?: string;
  headline?: string;
}

export type TipBoxStyle = "tip" | "warning";

export interface TipBoxContent {
  title: string;
  body: string;
  style: TipBoxStyle;
}

export type HeadingLevel = 2 | 3;

export interface HeadingContent {
  text: string;
  level: HeadingLevel;
}

export interface ParagraphContent {
  text: string;
}

export interface ImageContent {
  url: string;
  alt: string;
  caption?: string;
}

export interface QuoteContent {
  quote: string;
  author?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqGroupContent {
  items: FaqItem[];
}

export interface CtaBannerContent {
  label: string;
  href: string;
}

export interface BlockContentMap {
  guide_hero: GuideHeroContent;
  review_card: ReviewCardContent;
  category_shortcuts: CategoryShortcutsContent;
  featured_places: FeaturedPlacesContent;
  boat_tour_card: BoatTourCardContent;
  tip_box: TipBoxContent;
  heading: HeadingContent;
  paragraph: ParagraphContent;
  image: ImageContent;
  quote: QuoteContent;
  faq_group: FaqGroupContent;
  cta_banner: CtaBannerContent;
}

export type BlockContent<T extends WelcomeBlockType> = BlockContentMap[T];

export function isWelcomeBlockType(type: unknown): type is WelcomeBlockType {
  return typeof type === "string" && (WELCOME_BLOCK_TYPES as readonly string[]).includes(type);
}

export interface BaseWelcomeBlock<T extends WelcomeBlockType, C> {
  id: string;
  hubId?: string;
  type: T;
  displayOrder: number;
  content: C;
}

export type GuideHeroBlock = BaseWelcomeBlock<"guide_hero", GuideHeroContent>;
export type ReviewCardBlock = BaseWelcomeBlock<"review_card", ReviewCardContent>;
export type CategoryShortcutsBlock = BaseWelcomeBlock<"category_shortcuts", CategoryShortcutsContent>;
export type FeaturedPlacesBlock = BaseWelcomeBlock<"featured_places", FeaturedPlacesContent>;
export type BoatTourCardBlock = BaseWelcomeBlock<"boat_tour_card", BoatTourCardContent>;
export type TipBoxBlock = BaseWelcomeBlock<"tip_box", TipBoxContent>;
export type HeadingBlock = BaseWelcomeBlock<"heading", HeadingContent>;
export type ParagraphBlock = BaseWelcomeBlock<"paragraph", ParagraphContent>;
export type ImageBlock = BaseWelcomeBlock<"image", ImageContent>;
export type QuoteBlock = BaseWelcomeBlock<"quote", QuoteContent>;
export type FaqGroupBlock = BaseWelcomeBlock<"faq_group", FaqGroupContent>;
export type CtaBannerBlock = BaseWelcomeBlock<"cta_banner", CtaBannerContent>;

export type WelcomeBlock =
  | GuideHeroBlock
  | ReviewCardBlock
  | CategoryShortcutsBlock
  | FeaturedPlacesBlock
  | BoatTourCardBlock
  | TipBoxBlock
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | QuoteBlock
  | FaqGroupBlock
  | CtaBannerBlock;

/** Database row representation of welcome_hubs table */
export interface DbWelcomeHub {
  id: string;
  company_id: string;
  guide_id: string | null;
  title: string;
  intro: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Database row representation of welcome_blocks table */
export interface DbWelcomeBlock {
  id: string;
  hub_id: string;
  block_type: string;
  display_order: number;
  content: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

/** Domain model for a Welcome Hub */
export interface WelcomeHub {
  id: string;
  companyId: string;
  guideId: string | null;
  title: string;
  intro: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  blocks?: WelcomeBlock[];
}
