// The guest Welcome screen — PRD §5.1. This is the (guest) route group's
// page.tsx, so it *is* the site root ("/"): it replaces the stock Next.js
// starter homepage that used to live at src/app/page.tsx. The two could not
// coexist — Next.js errors on route groups whose pages resolve to the same
// URL (see the "Conflicting paths" caveat in
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions
// /route-groups.md) — and the real home route (/) has to live inside a
// route group per that same doc's "Top-level root layout" note, since this
// project already has other top-level segments (studio/, admin/).
//
// Server Component: resolves tenant/guide/top-pick through the DataSource
// interface (src/lib/data/source.ts), exactly like
// src/app/(guest)/map/page.tsx, then hands off to the client component that
// owns the install-banner and share-section browser state.

import GuestWelcomeScreen from "@/components/guest/GuestWelcomeScreen";
import { getMapPins } from "@/lib/data/source";
import { guestQueryString } from "@/lib/guestLinks";
import { getGuestContext } from "@/lib/guestServerContext";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { brand, guide, companyId } = await getGuestContext();
  const pins = companyId ? await getMapPins(companyId) : [];

  // getMapPins puts boats first, in featured position order (see its own
  // header comment) — so the first boat pin in the feed IS "the featured
  // boat tour" the PRD's top-pick default refers to.
  const topPick = pins.find((p) => p.isBoat) ?? null;
  const placeCount = pins.filter((p) => !p.isBoat).length;

  const qs = guestQueryString(await searchParams);

  return (
    <GuestWelcomeScreen
      brand={brand}
      guideName={guide?.name ?? "your guide"}
      guideAvatarInitial={guide?.avatarInitial ?? "?"}
      guideWelcome={
        guide?.welcome ??
        "Welcome! I've collected my favourite spots in the city, just for you."
      }
      placeCount={placeCount}
      topPick={topPick}
      qs={qs}
    />
  );
}
