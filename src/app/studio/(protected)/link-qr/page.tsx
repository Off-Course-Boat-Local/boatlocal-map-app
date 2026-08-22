// The old combined "Profile, Link & QR / Stats" tab, kept as a redirect.
//
// Its three jobs were split (see src/lib/studio/nav.ts's header): profile +
// share link + QR are now /studio/profile, the account is /studio/settings,
// and the event counts moved onto the Dashboard. This route survives only so
// that a bookmark — or a link someone pasted into a chat back when this was
// the guide's main page — still lands somewhere sensible instead of a 404.
//
// Profile is the right target: it holds the share link and QR, which is what
// anyone deep-linking to "link-qr" was after.

import { redirect } from "next/navigation";

export default function StudioLinkQrRedirectPage() {
  redirect("/studio/profile");
}
