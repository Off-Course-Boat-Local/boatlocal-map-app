import { List } from "lucide-react";
import Link from "next/link";

import { CategoryGlyph } from "@/components/map/Pin";
import { CATEGORY_MAP } from "@/lib/categories";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { CategoryId } from "@/lib/types";

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
  const { t } = useI18n();
  return (
    <section aria-label="Categories" className="grid grid-cols-2 gap-2.5">
      {content.categoryKeys.map((key) => {
        const cat = CATEGORY_MAP[key as CategoryId];
        const label = cat ? t.categories[cat.id] : key;
        return (
          <div
            key={key}
            className="flex items-center overflow-hidden rounded-2xl border border-[#E3E4E8] bg-white"
          >
            {/* Whole tile body opens the map for this category... */}
            <Link
              href={withCategory("/map", key, ctx.qs)}
              className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-2.5 pr-1"
            >
              {cat && (
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${cat.color}1F` }}
                >
                  <CategoryGlyph category={cat.id} size={18} color={cat.color} />
                </span>
              )}
              <span className="truncate text-sm font-semibold text-[#17181C]">{label}</span>
            </Link>
            {/* ...the small button opens the same category as a list. */}
            <Link
              href={withCategory("/list", key, ctx.qs)}
              aria-label={`${label}: ${t.nav.list}`}
              className="flex h-full w-11 shrink-0 items-center justify-center self-stretch border-l border-[#EEF0F3] text-[#6B7280]"
            >
              <List size={16} aria-hidden="true" />
            </Link>
          </div>
        );
      })}
    </section>
  );
}
