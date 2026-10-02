// Boat Local Map App — Welcome Hub data-access layer.
//
// Backs the Welcome Hub & customizable block system for public guests
// and Studio admins/guides. Follows the same pattern as source.ts:
//   - in test environment (process.env.VITEST === "true"): uses an in-memory store.
//   - in production environment: uses Supabase anon client for public reads
//     and authed client (dynamically imported) for Studio actor mutations.

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type {
  DbWelcomeBlock,
  DbWelcomeHub,
  WelcomeBlock,
  WelcomeBlockType,
  WelcomeHub,
} from "@/types/welcome-blocks";
import type { StudioActor } from "./types";
import { StudioPermissionError } from "./types";

const isTestEnv = process.env.VITEST === "true";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// Supabase Client Tiers (Anon & Authed)
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function makeAnonClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase client is missing NEXT_PUBLIC_SUPABASE_URL or " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createSupabaseJsClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let cachedAnonClient: ReturnType<typeof makeAnonClient> | null = null;
function anonClient() {
  if (cachedAnonClient) return cachedAnonClient;
  cachedAnonClient = makeAnonClient();
  return cachedAnonClient;
}

async function authedClient() {
  const { createClient } = await import("../supabase/server");
  return createClient();
}

// =============================================================================
// In-Memory Test Store
// =============================================================================

let fakeWelcomeHubs: DbWelcomeHub[] = [];
let fakeWelcomeBlocks: DbWelcomeBlock[] = [];

/** Test-only helper to reset the in-memory store between test cases. */
export function resetFakeWelcomeHubStore(): void {
  fakeWelcomeHubs = [];
  fakeWelcomeBlocks = [];
}

// =============================================================================
// Domain / DB Mappers & Fallback Generator
// =============================================================================

export function fromDbWelcomeHub(row: DbWelcomeHub, blocks?: WelcomeBlock[]): WelcomeHub {
  return {
    id: row.id,
    companyId: row.company_id,
    guideId: row.guide_id,
    title: row.title ?? "",
    intro: row.intro ?? "",
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(blocks ? { blocks } : {}),
  };
}

export function fromDbWelcomeBlock(row: DbWelcomeBlock): WelcomeBlock {
  return {
    id: row.id,
    hubId: row.hub_id,
    type: row.block_type as WelcomeBlockType,
    displayOrder: row.display_order,
    content: row.content as unknown as WelcomeBlock["content"],
  } as WelcomeBlock;
}

/**
 * Standard fallback initial blocks when no hub exists for a company or guide.
 */
export function getFallbackWelcomeBlocks(): WelcomeBlock[] {
  return [
    {
      id: generateUUID(),
      type: "guide_hero",
      displayOrder: 0,
      content: {
        title: "Welkom!",
        greeting: "Bedankt voor je bezoek!",
        showAvatar: true,
      },
    },
    {
      id: generateUUID(),
      type: "review_card",
      displayOrder: 1,
      content: {
        promptText: "Laat een review achter",
        platforms: ["google", "tripadvisor"],
      },
    },
    {
      id: generateUUID(),
      type: "category_shortcuts",
      displayOrder: 2,
      content: {
        categoryKeys: ["lunch", "dinner", "drinks"],
      },
    },
    {
      id: generateUUID(),
      type: "tip_box",
      displayOrder: 3,
      content: {
        title: "Lokale tip",
        body: "Vergeet je fiets niet op slot te zetten!",
        style: "tip",
      },
    },
  ];
}

// =============================================================================
// Permission Validation
// =============================================================================

function assertHubWritePermission(
  actor: StudioActor,
  companyId: string,
  guideId: string | null | undefined,
): void {
  if (actor.role === "admin") {
    return;
  }
  if (actor.role === "company") {
    if (actor.companyId !== companyId) {
      throw new StudioPermissionError(
        `Company actor for ${actor.companyId} may not modify welcome hub for company ${companyId}.`,
      );
    }
    return;
  }
  if (actor.role === "guide") {
    if (actor.companyId !== companyId) {
      throw new StudioPermissionError(
        `Guide actor for company ${actor.companyId} may not modify welcome hub for company ${companyId}.`,
      );
    }
    if (!guideId) {
      throw new StudioPermissionError(
        "Guide actor may not modify company default welcome hub.",
      );
    }
    if (actor.guideId !== guideId) {
      throw new StudioPermissionError(
        `Guide actor ${actor.guideId} may not modify welcome hub for guide ${guideId}.`,
      );
    }
    return;
  }
  throw new StudioPermissionError("Unknown actor role.");
}

// =============================================================================
// Public Reads
// =============================================================================

export interface GetWelcomeHubOptions {
  /** If true, returns the exact hub record for (companyId, guideId) without falling back. */
  exact?: boolean;
}

/**
 * Retrieves a welcome hub. By default, checks for guide override first; if inactive or
 * missing, falls back to the company default hub.
 */
export async function getWelcomeHub(
  companyId: string,
  guideId?: string | null,
  options?: GetWelcomeHubOptions,
): Promise<WelcomeHub | null> {
  const normalizedGuideId = guideId ?? null;

  if (isTestEnv) {
    if (options?.exact) {
      const hub = fakeWelcomeHubs.find(
        (h) => h.company_id === companyId && h.guide_id === normalizedGuideId,
      );
      if (!hub) return null;
      const blocks = fakeWelcomeBlocks
        .filter((b) => b.hub_id === hub.id)
        .sort((a, b) => a.display_order - b.display_order)
        .map(fromDbWelcomeBlock);
      return fromDbWelcomeHub(hub, blocks);
    }

    // 1. If guideId is given, check for active guide hub
    if (normalizedGuideId) {
      const guideHub = fakeWelcomeHubs.find(
        (h) => h.company_id === companyId && h.guide_id === normalizedGuideId,
      );
      if (guideHub && guideHub.is_active) {
        const blocks = fakeWelcomeBlocks
          .filter((b) => b.hub_id === guideHub.id)
          .sort((a, b) => a.display_order - b.display_order)
          .map(fromDbWelcomeBlock);
        return fromDbWelcomeHub(guideHub, blocks);
      }
    }

    // 2. Check company default hub
    const companyHub = fakeWelcomeHubs.find(
      (h) => h.company_id === companyId && (h.guide_id === null || h.guide_id === undefined),
    );
    if (companyHub && companyHub.is_active) {
      const blocks = fakeWelcomeBlocks
        .filter((b) => b.hub_id === companyHub.id)
        .sort((a, b) => a.display_order - b.display_order)
        .map(fromDbWelcomeBlock);
      return fromDbWelcomeHub(companyHub, blocks);
    }

    return null;
  }

  // Production Supabase query
  const supabase = anonClient();

  if (options?.exact) {
    let query = supabase.from("welcome_hubs").select("*").eq("company_id", companyId);
    if (normalizedGuideId) {
      query = query.eq("guide_id", normalizedGuideId);
    } else {
      query = query.is("guide_id", null);
    }
    const { data: hub, error } = await query.maybeSingle();
    if (error) throw error;
    if (!hub) return null;

    const { data: blockRows, error: blocksError } = await supabase
      .from("welcome_blocks")
      .select("*")
      .eq("hub_id", hub.id)
      .order("display_order", { ascending: true });
    if (blocksError) throw blocksError;

    const blocks = (blockRows ?? []).map(fromDbWelcomeBlock);
    return fromDbWelcomeHub(hub as DbWelcomeHub, blocks);
  }

  // 1. If guideId is given, check for active guide hub
  if (normalizedGuideId) {
    const { data: guideHub, error: guideError } = await supabase
      .from("welcome_hubs")
      .select("*")
      .eq("company_id", companyId)
      .eq("guide_id", normalizedGuideId)
      .maybeSingle();
    if (guideError) throw guideError;

    if (guideHub && guideHub.is_active) {
      const { data: blockRows, error: blocksError } = await supabase
        .from("welcome_blocks")
        .select("*")
        .eq("hub_id", guideHub.id)
        .order("display_order", { ascending: true });
      if (blocksError) throw blocksError;

      const blocks = (blockRows ?? []).map(fromDbWelcomeBlock);
      return fromDbWelcomeHub(guideHub as DbWelcomeHub, blocks);
    }
  }

  // 2. Check company default hub
  const { data: companyHub, error: companyError } = await supabase
    .from("welcome_hubs")
    .select("*")
    .eq("company_id", companyId)
    .is("guide_id", null)
    .maybeSingle();
  if (companyError) throw companyError;

  if (companyHub && companyHub.is_active) {
    const { data: blockRows, error: blocksError } = await supabase
      .from("welcome_blocks")
      .select("*")
      .eq("hub_id", companyHub.id)
      .order("display_order", { ascending: true });
    if (blocksError) throw blocksError;

    const blocks = (blockRows ?? []).map(fromDbWelcomeBlock);
    return fromDbWelcomeHub(companyHub as DbWelcomeHub, blocks);
  }

  return null;
}

/**
 * Returns blocks for a welcome hub, strictly sorted by displayOrder.
 * Falls back to default initial blocks if neither guide hub nor company hub exists.
 */
export async function getWelcomeHubBlocks(
  companyId: string,
  guideId?: string | null,
): Promise<WelcomeBlock[]> {
  const hub = await getWelcomeHub(companyId, guideId);
  if (hub && hub.blocks && hub.blocks.length > 0) {
    return [...hub.blocks].sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return getFallbackWelcomeBlocks();
}

// =============================================================================
// Studio Actor Mutations
// =============================================================================

/**
 * Upserts a welcome hub and completely replaces its blocks with sequential displayOrder.
 */
export async function saveWelcomeHubBlocks(
  actor: StudioActor,
  companyId: string,
  guideId: string | null | undefined,
  blocks: WelcomeBlock[],
  hubMeta?: { title?: string; intro?: string; isActive?: boolean },
): Promise<WelcomeHub> {
  assertHubWritePermission(actor, companyId, guideId);
  const normalizedGuideId = guideId ?? null;
  const now = new Date().toISOString();

  if (isTestEnv) {
    let hub = fakeWelcomeHubs.find(
      (h) => h.company_id === companyId && h.guide_id === normalizedGuideId,
    );
    if (hub) {
      if (hubMeta?.title !== undefined) hub.title = hubMeta.title;
      if (hubMeta?.intro !== undefined) hub.intro = hubMeta.intro;
      if (hubMeta?.isActive !== undefined) hub.is_active = hubMeta.isActive;
      hub.updated_at = now;
    } else {
      hub = {
        id: generateUUID(),
        company_id: companyId,
        guide_id: normalizedGuideId,
        title: hubMeta?.title ?? "",
        intro: hubMeta?.intro ?? "",
        is_active: hubMeta?.isActive ?? true,
        created_at: now,
        updated_at: now,
      };
      fakeWelcomeHubs.push(hub);
    }

    // Replace blocks: remove old blocks for this hub
    fakeWelcomeBlocks = fakeWelcomeBlocks.filter((b) => b.hub_id !== hub.id);

    // Insert new blocks with sequential display_order = index
    const newDbBlocks: DbWelcomeBlock[] = blocks.map((b, index) => ({
      id: b.id || generateUUID(),
      hub_id: hub.id,
      block_type: b.type,
      display_order: index,
      content: JSON.parse(JSON.stringify(b.content)),
      created_at: now,
      updated_at: now,
    }));
    fakeWelcomeBlocks.push(...newDbBlocks);

    const domainBlocks = newDbBlocks.map(fromDbWelcomeBlock);
    return fromDbWelcomeHub(hub, domainBlocks);
  }

  const supabase = await authedClient();

  let query = supabase.from("welcome_hubs").select("*").eq("company_id", companyId);
  if (normalizedGuideId) {
    query = query.eq("guide_id", normalizedGuideId);
  } else {
    query = query.is("guide_id", null);
  }
  const { data: existingData, error: findError } = await query.maybeSingle();
  if (findError) throw findError;

  let hubRow: DbWelcomeHub;
  if (existingData) {
    const updatePayload: Partial<DbWelcomeHub> = {
      updated_at: now,
    };
    if (hubMeta?.title !== undefined) updatePayload.title = hubMeta.title;
    if (hubMeta?.intro !== undefined) updatePayload.intro = hubMeta.intro;
    if (hubMeta?.isActive !== undefined) updatePayload.is_active = hubMeta.isActive;

    const { data: updated, error: updateError } = await supabase
      .from("welcome_hubs")
      .update(updatePayload)
      .eq("id", existingData.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    hubRow = updated as DbWelcomeHub;
  } else {
    const insertPayload = {
      company_id: companyId,
      guide_id: normalizedGuideId,
      title: hubMeta?.title ?? "",
      intro: hubMeta?.intro ?? "",
      is_active: hubMeta?.isActive ?? true,
      created_at: now,
      updated_at: now,
    };
    const { data: inserted, error: insertError } = await supabase
      .from("welcome_hubs")
      .insert(insertPayload)
      .select("*")
      .single();
    if (insertError) throw insertError;
    hubRow = inserted as DbWelcomeHub;
  }

  // Delete old blocks
  const { error: deleteError } = await supabase
    .from("welcome_blocks")
    .delete()
    .eq("hub_id", hubRow.id);
  if (deleteError) throw deleteError;

  // Insert new blocks with sequential display_order = index
  const blocksToInsert = blocks.map((b, index) => ({
    id: b.id || generateUUID(),
    hub_id: hubRow.id,
    block_type: b.type,
    display_order: index,
    content: b.content,
    created_at: now,
    updated_at: now,
  }));

  let savedBlocks: WelcomeBlock[] = [];
  if (blocksToInsert.length > 0) {
    const { data: insertedBlocks, error: insertBlocksError } = await supabase
      .from("welcome_blocks")
      .insert(blocksToInsert)
      .select("*")
      .order("display_order", { ascending: true });
    if (insertBlocksError) throw insertBlocksError;
    savedBlocks = (insertedBlocks ?? []).map(fromDbWelcomeBlock);
  }

  return fromDbWelcomeHub(hubRow, savedBlocks);
}

/**
 * Copies company default blocks into a new guide hub for guideId.
 * If company default has no hub yet, copies the default auto-generated fallback blocks.
 */
export async function cloneCompanyHubToGuide(
  actor: StudioActor,
  companyId: string,
  guideId: string,
): Promise<WelcomeHub> {
  assertHubWritePermission(actor, companyId, guideId);

  const companyHub = await getWelcomeHub(companyId, null, { exact: true });
  let sourceBlocks: WelcomeBlock[] = [];
  let sourceTitle = "";
  let sourceIntro = "";

  if (companyHub && companyHub.blocks && companyHub.blocks.length > 0) {
    sourceBlocks = companyHub.blocks;
    sourceTitle = companyHub.title;
    sourceIntro = companyHub.intro;
  } else {
    sourceBlocks = getFallbackWelcomeBlocks();
  }

  const clonedBlocks: WelcomeBlock[] = sourceBlocks.map((b, index) => ({
    ...b,
    id: generateUUID(),
    displayOrder: index,
    content: JSON.parse(JSON.stringify(b.content)),
  }));

  return saveWelcomeHubBlocks(actor, companyId, guideId, clonedBlocks, {
    title: sourceTitle,
    intro: sourceIntro,
    isActive: true,
  });
}

/**
 * Deletes the guide-specific hub, causing getWelcomeHubBlocks(companyId, guideId)
 * to fall back to the company default.
 */
export async function resetGuideHubToCompany(
  actor: StudioActor,
  companyId: string,
  guideId: string,
): Promise<void> {
  assertHubWritePermission(actor, companyId, guideId);

  if (isTestEnv) {
    const hubIndex = fakeWelcomeHubs.findIndex(
      (h) => h.company_id === companyId && h.guide_id === guideId,
    );
    if (hubIndex !== -1) {
      const hub = fakeWelcomeHubs[hubIndex];
      fakeWelcomeBlocks = fakeWelcomeBlocks.filter((b) => b.hub_id !== hub.id);
      fakeWelcomeHubs.splice(hubIndex, 1);
    }
    return;
  }

  const supabase = await authedClient();
  const { data: hub, error: fetchError } = await supabase
    .from("welcome_hubs")
    .select("id")
    .eq("company_id", companyId)
    .eq("guide_id", guideId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (hub) {
    const { error: deleteBlocksError } = await supabase
      .from("welcome_blocks")
      .delete()
      .eq("hub_id", hub.id);
    if (deleteBlocksError) throw deleteBlocksError;

    const { error: deleteHubError } = await supabase
      .from("welcome_hubs")
      .delete()
      .eq("id", hub.id);
    if (deleteHubError) throw deleteHubError;
  }
}
