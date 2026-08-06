// Bridges the real Admin session (src/lib/admin/devAuth.ts) to the
// data-access layer's StudioActor. There is exactly one admin role (unlike
// Studio's company/guide split), so this is a constant, not a lookup.

import type { StudioActor } from "@/lib/data/types";

export const ADMIN_ACTOR: StudioActor = { role: "admin" };
