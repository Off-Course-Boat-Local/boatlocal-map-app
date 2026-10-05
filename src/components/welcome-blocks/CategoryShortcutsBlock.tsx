import Link from "next/link";

import { withGuestQuery } from "@/lib/guestLinks";
import type { CategoryShortcutsContent } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";

function withCategory(path: string, key: string, qs: string): string {
  const params = new URLSearchParams(qs);
  params.set("category", key);
  return withGuestQuery(path, params.toString());
}

export function CategoryShortcutsBlock({
  content,
  ctx,
}: {
  content: CategoryShortcutsContent;
  ctx: WelcomeBlockContext;
}) {
  return (
    <section aria-label="Categories" className="flex flex-wrap gap-2">
      {content.categoryKeys.map((key) => (
        <span key={key} className="inline-flex overflow-hidden rounded-full border border-[#E3E4E8] bg-white text-sm">
          <Link href={withCategory("/map", key, ctx.qs)} className="px-3 py-1.5 font-medium capitalize text-[#17181C]">
            {key}
          </Link>
          <Link
            href={withCategory("/list", key, ctx.qs)}
            aria-label={`${key} list`}
            className="border-l border-[#E3E4E8] px-2.5 py-1.5 text-[#6B7280]"
          >
            List
          </Link>
        </span>
      ))}
    </section>
  );
}
