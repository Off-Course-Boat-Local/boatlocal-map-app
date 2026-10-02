import {
  type WelcomeBlockType,
  type WelcomeBlock,
  type BlockContent,
  type GuideHeroContent,
  type ReviewCardContent,
  type CategoryShortcutsContent,
  type FeaturedPlacesContent,
  type BoatTourCardContent,
  type TipBoxContent,
  type HeadingContent,
  type ParagraphContent,
  type ImageContent,
  type QuoteContent,
  type FaqGroupContent,
  type CtaBannerContent,
} from "@/types/welcome-blocks";

export interface BlockDefinition<T extends WelcomeBlockType = WelcomeBlockType> {
  type: T;
  label: string;
  description: string;
  icon: string;
  createDefaultContent: () => BlockContent<T>;
}

export const BLOCK_REGISTRY: Record<WelcomeBlockType, BlockDefinition<WelcomeBlockType>> = {
  guide_hero: {
    type: "guide_hero",
    label: "Gids Introductie",
    description: "Persoonlijk welkomstwoord, profielfoto en bedankje van de gids",
    icon: "User",
    createDefaultContent: (): GuideHeroContent => ({
      title: "Welkom!",
      greeting: "Bedankt voor de tour vandaag!",
      showAvatar: true,
    }),
  },
  review_card: {
    type: "review_card",
    label: "Review Kaart",
    description: "Directe links om een 5-sterren review achter te laten op platforms",
    icon: "Star",
    createDefaultContent: (): ReviewCardContent => ({
      promptText: "Vond je de tour leuk? Laat een review achter!",
      platforms: ["tripadvisor", "google", "guruwalk"],
    }),
  },
  category_shortcuts: {
    type: "category_shortcuts",
    label: "Categorie Snelkoppelingen",
    description: "Snelle filters naar populaire categorieën zoals Lunch, Diner of Borrel",
    icon: "Compass",
    createDefaultContent: (): CategoryShortcutsContent => ({
      categoryKeys: ["lunch", "dinner", "drinks"],
    }),
  },
  featured_places: {
    type: "featured_places",
    label: "Uitgelichte Plekken",
    description: "Aanbevolen locaties van de gids met optionele kortingsbadge",
    icon: "MapPin",
    createDefaultContent: (): FeaturedPlacesContent => ({
      placeIds: [],
      showDiscountBadge: false,
    }),
  },
  boat_tour_card: {
    type: "boat_tour_card",
    label: "Boottocht Kaart",
    description: "Promoot een aansluitende rondvaart of boottocht met directe boeking",
    icon: "Ship",
    createDefaultContent: (): BoatTourCardContent => ({
      tourId: undefined,
      headline: "Vaar mee over de Amsterdamse grachten",
    }),
  },
  tip_box: {
    type: "tip_box",
    label: "Tip Box",
    description: "Opvallend kader voor insider tips of dingen om te vermijden",
    icon: "Lightbulb",
    createDefaultContent: (): TipBoxContent => ({
      title: "Lokale tip",
      body: "Vergeet niet je fiets op slot te zetten!",
      style: "tip",
    }),
  },
  heading: {
    type: "heading",
    label: "Koptekst",
    description: "Titel of tussenkop voor het structureren van secties",
    icon: "Heading",
    createDefaultContent: (): HeadingContent => ({
      text: "Nieuwe sectie",
      level: 2,
    }),
  },
  paragraph: {
    type: "paragraph",
    label: "Paragraaf",
    description: "Vrije tekst voor uitgebreide tips, verhalen of uitleg",
    icon: "AlignLeft",
    createDefaultContent: (): ParagraphContent => ({
      text: "Schrijf hier een toelichting voor je gasten...",
    }),
  },
  image: {
    type: "image",
    label: "Afbeelding",
    description: "Sfeervolle foto met optionele bijschrift en alt-tekst",
    icon: "Image",
    createDefaultContent: (): ImageContent => ({
      url: "",
      alt: "",
      caption: "",
    }),
  },
  quote: {
    type: "quote",
    label: "Citaat",
    description: "Uitgelicht citaat of gezegde van de gids",
    icon: "Quote",
    createDefaultContent: (): QuoteContent => ({
      quote: "Amsterdam is altijd een goed idee.",
      author: "",
    }),
  },
  faq_group: {
    type: "faq_group",
    label: "Veelgestelde Vragen",
    description: "Uitklapbare veelgestelde vragen over vervoer, fooien en meer",
    icon: "HelpCircle",
    createDefaultContent: (): FaqGroupContent => ({
      items: [
        {
          question: "Waar kan ik de gids bereiken?",
          answer: "Stuur een berichtje via WhatsApp of email.",
        },
      ],
    }),
  },
  cta_banner: {
    type: "cta_banner",
    label: "CTA Banner",
    description: "Opvallende actieknop naar een externe pagina of interne route",
    icon: "ExternalLink",
    createDefaultContent: (): CtaBannerContent => ({
      label: "Bekijk alle aanbevelingen",
      href: "/map",
    }),
  },
};

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getBlockDefinition(
  type: string
): BlockDefinition<WelcomeBlockType> | undefined {
  if (type in BLOCK_REGISTRY) {
    return BLOCK_REGISTRY[type as WelcomeBlockType];
  }
  return undefined;
}

export function createDefaultBlock(
  type: WelcomeBlockType,
  displayOrder: number = 0
): WelcomeBlock {
  const definition = getBlockDefinition(type);
  if (!definition) {
    throw new Error(`Unknown welcome block type: ${type}`);
  }

  return {
    id: generateUUID(),
    type,
    displayOrder,
    content: definition.createDefaultContent(),
  } as WelcomeBlock;
}
