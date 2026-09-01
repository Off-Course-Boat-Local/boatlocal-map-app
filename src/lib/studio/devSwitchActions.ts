"use server";

// Thin Server Action boundary for the localhost company switcher — see
// devSwitch.ts's header comment for the full rationale. This file exists
// only because devSwitch.ts is `server-only` (it touches the service-role
// admin client) and a Client Component may never import a `server-only`
// module, even transitively; a "use server" file is the one thing a Client
// Component is allowed to import directly, since only an action reference
// crosses the boundary, not the implementation.

import { enterCompanyStudio } from "./devSwitch";

export async function devEnterCompanyStudioAction(companyId: string): Promise<void> {
  await enterCompanyStudio(companyId);
}
