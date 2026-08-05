// The real Install (PWA "Add to Home Screen") screen — PRD §5.7. See
// src/components/guest/InstallScreen.tsx for the iOS-vs-Android split and
// public/sw.js for the service worker this app registers alongside it
// (src/components/guest/ServiceWorkerRegister.tsx, mounted once in
// src/app/(guest)/layout.tsx).

import InstallScreen from "@/components/guest/InstallScreen";
import { getGuestContext } from "@/lib/guestServerContext";

export default async function InstallPage() {
  const { brand, companyId } = await getGuestContext();
  return <InstallScreen brand={brand} companyId={companyId} />;
}
