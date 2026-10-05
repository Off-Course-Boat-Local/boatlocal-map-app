import { isWelcomeBlockType, type WelcomeBlock } from "@/types/welcome-blocks";
import { createDefaultBlock } from "./registry";

export const MAX_BLOCKS_PER_HUB = 50;
const MAX_BLOCK_JSON_BYTES = 20_000;

export class WelcomeBlockValidationError extends Error {}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Only http(s) URLs may be stored for outbound links; anything else (javascript:, data:) is dropped. */
export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates editor input before it reaches the database: known types only, a
 * bounded count and size, plain-object content, safe outbound URLs. Returns
 * blocks with sequential displayOrder. Throws WelcomeBlockValidationError.
 */
export function validateWelcomeBlocks(input: unknown): WelcomeBlock[] {
  if (!Array.isArray(input)) throw new WelcomeBlockValidationError("Blocks must be a list.");
  if (input.length > MAX_BLOCKS_PER_HUB) {
    throw new WelcomeBlockValidationError(`A hub can have at most ${MAX_BLOCKS_PER_HUB} blocks.`);
  }
  return input.map((raw, index) => {
    if (!isPlainObject(raw) || !isWelcomeBlockType(raw.type)) {
      throw new WelcomeBlockValidationError(`Block ${index + 1} has an unknown type.`);
    }
    if (!isPlainObject(raw.content)) {
      throw new WelcomeBlockValidationError(`Block ${index + 1} has invalid content.`);
    }
    if (JSON.stringify(raw.content).length > MAX_BLOCK_JSON_BYTES) {
      throw new WelcomeBlockValidationError(`Block ${index + 1} is too large.`);
    }
    const content: Record<string, unknown> = { ...raw.content };

    if (raw.type === "review_card" && isPlainObject(content.urls)) {
      const urls: Record<string, string> = {};
      for (const [platform, url] of Object.entries(content.urls)) {
        const safe = safeHttpUrl(url);
        if (safe) urls[platform] = safe;
      }
      content.urls = urls;
    }
    if (raw.type === "cta_banner" && typeof content.href === "string") {
      const href = content.href.trim();
      const internal = href.startsWith("/") && !href.startsWith("//");
      if (!internal && !safeHttpUrl(href)) {
        throw new WelcomeBlockValidationError(`Block ${index + 1}: link must be http(s) or an in-app path.`);
      }
    }
    if (raw.type === "image" && content.url !== undefined && !safeHttpUrl(content.url)) {
      throw new WelcomeBlockValidationError(`Block ${index + 1}: image URL must be http(s).`);
    }

    // Reuse the registry's id generator by minting a default block, then overlay editor data.
    const id = typeof raw.id === "string" && raw.id ? raw.id : createDefaultBlock(raw.type).id;
    return { id, type: raw.type, displayOrder: index, content } as WelcomeBlock;
  });
}
