import { photoUrl } from "@/lib/photoUrl";
import type { GuideHeroContent } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";

export function GuideHeroBlock({ content, ctx }: { content: GuideHeroContent; ctx: WelcomeBlockContext }) {
  const photo = content.photoUrl ? photoUrl(content.photoUrl, { width: 420 }) : "";
  return (
    <section
      className="overflow-hidden rounded-2xl text-center text-white"
      style={{ background: `linear-gradient(160deg, ${ctx.brand.primary}, ${ctx.brand.primaryDark})` }}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={ctx.guideName} className="aspect-[4/3] w-full object-cover" />
      )}
      <div className="p-5">
        {!photo && content.showAvatar !== false && (
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
      </div>
    </section>
  );
}
