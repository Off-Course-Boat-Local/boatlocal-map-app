import type { CtaBannerContent, FaqGroupContent, HeadingContent, ImageContent, ParagraphContent, QuoteContent } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";

export function HeadingBlock({ content }: { content: HeadingContent }) {
  const Tag = content.level === 3 ? "h3" : "h2";
  return <Tag className="text-lg font-semibold text-[#17181C]">{content.text}</Tag>;
}

export function ParagraphBlock({ content }: { content: ParagraphContent }) {
  return <p className="text-sm leading-relaxed text-[#17181C]">{content.text}</p>;
}

export function ImageBlock({ content }: { content: ImageContent }) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.url} alt={content.alt} className="w-full rounded-2xl" />
      {content.caption && <figcaption className="mt-1 text-xs text-[#6B7280]">{content.caption}</figcaption>}
    </figure>
  );
}

export function QuoteBlock({ content }: { content: QuoteContent }) {
  return (
    <blockquote className="border-l-4 border-[#E3E4E8] pl-4 text-sm italic text-[#17181C]">
      {content.quote}
      {content.author && <footer className="mt-1 text-xs not-italic text-[#6B7280]">— {content.author}</footer>}
    </blockquote>
  );
}

export function FaqGroupBlock({ content }: { content: FaqGroupContent }) {
  return (
    <section className="flex flex-col gap-2">
      {content.items.map((item, i) => (
        <details key={i} className="rounded-xl border border-[#E3E4E8] bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#17181C]">{item.question}</summary>
          <p className="mt-2 text-sm text-[#17181C]">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

/** Only http(s) and in-app paths are linkable — never javascript: or data: URLs from editor content. */
function isSafeHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//"));
}

export function CtaBannerBlock({ content, ctx }: { content: CtaBannerContent; ctx: WelcomeBlockContext }) {
  if (!isSafeHref(content.href)) return null;
  return (
    <a
      href={content.href}
      className="block rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white"
      style={{ background: ctx.brand.primary }}
    >
      {content.label}
    </a>
  );
}
