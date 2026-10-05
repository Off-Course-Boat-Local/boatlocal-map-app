import type { GuideHeroContent } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";

export function GuideHeroBlock({ content, ctx }: { content: GuideHeroContent; ctx: WelcomeBlockContext }) {
  return (
    <section
      className="rounded-2xl p-5 text-center text-white"
      style={{ background: `linear-gradient(160deg, ${ctx.brand.primary}, ${ctx.brand.primaryDark})` }}
    >
      {content.showAvatar !== false && (
        <div
          aria-hidden="true"
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold"
          style={{ color: ctx.brand.primary }}
        >
          {ctx.guideAvatarInitial}
        </div>
      )}
      <h2 className="text-xl font-semibold">{content.title || ctx.guideName}</h2>
      {content.greeting && <p className="mt-2 text-sm leading-relaxed opacity-95">{content.greeting}</p>}
      <p className="mt-2 text-xs opacity-80">— {ctx.guideName}</p>
    </section>
  );
}
