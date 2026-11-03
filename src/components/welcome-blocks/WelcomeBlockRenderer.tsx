import type { ReactNode } from "react";

import type { WelcomeBlock } from "@/types/welcome-blocks";
import { BoatTourCardBlock } from "./BoatTourCardBlock";
import { CategoryShortcutsBlock } from "./CategoryShortcutsBlock";
import type { WelcomeBlockContext } from "./context";
import { FeaturedPlacesBlock } from "./FeaturedPlacesBlock";
import { GuideHeroBlock } from "./GuideHeroBlock";
import { ReviewCardBlock } from "./ReviewCardBlock";
import { CtaBannerBlock, FaqGroupBlock, HeadingBlock, ImageBlock, ParagraphBlock, QuoteBlock } from "./TextBlocks";
import { TipBoxBlock } from "./TipBoxBlock";

function renderBlock(block: WelcomeBlock, ctx: WelcomeBlockContext): ReactNode {
  switch (block.type) {
    case "guide_hero": return <GuideHeroBlock content={block.content} ctx={ctx} />;
    case "review_card": return <ReviewCardBlock content={block.content} ctx={ctx} />;
    case "category_shortcuts": return <CategoryShortcutsBlock content={block.content} ctx={ctx} />;
    case "featured_places": return <FeaturedPlacesBlock content={block.content} ctx={ctx} />;
    case "boat_tour_card": return <BoatTourCardBlock content={block.content} ctx={ctx} />;
    case "tip_box": return <TipBoxBlock content={block.content} />;
    case "heading": return <HeadingBlock content={block.content} />;
    case "paragraph": return <ParagraphBlock content={block.content} />;
    case "image": return <ImageBlock content={block.content} />;
    case "quote": return <QuoteBlock content={block.content} />;
    case "faq_group": return <FaqGroupBlock content={block.content} />;
    case "cta_banner": return <CtaBannerBlock content={block.content} ctx={ctx} />;
    default: return null; // unknown/legacy type from the DB — skip rather than crash the page
  }
}

/** Any block may set `content.panel = "dark"`; consecutive such blocks share one navy panel. */
function inDarkPanel(block: WelcomeBlock): boolean {
  return (block.content as { panel?: unknown }).panel === "dark";
}

export function WelcomeBlockRenderer({ blocks, ctx }: { blocks: WelcomeBlock[]; ctx: WelcomeBlockContext }) {
  const sorted = [...blocks].sort((a, b) => a.displayOrder - b.displayOrder);
  const groups: WelcomeBlock[][] = [];
  for (const block of sorted) {
    const last = groups[groups.length - 1];
    if (last && inDarkPanel(last[0]) && inDarkPanel(block)) last.push(block);
    else groups.push([block]);
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) =>
        inDarkPanel(group[0]) ? (
          <div
            key={group[0].id}
            className="flex flex-col gap-4 rounded-3xl bg-[#0F2A4A] p-4 [&>div>figure>figcaption]:text-white/70 [&>div>h2]:text-white [&>div>h3]:text-white [&>div>p]:text-white/90 [&>div>a]:border [&>div>a]:border-white/40 [&>div>a]:bg-transparent!"
          >
            {group.map((block) => (
              <div key={block.id}>{renderBlock(block, ctx)}</div>
            ))}
          </div>
        ) : (
          <div key={group[0].id}>{renderBlock(group[0], ctx)}</div>
        ),
      )}
    </div>
  );
}
