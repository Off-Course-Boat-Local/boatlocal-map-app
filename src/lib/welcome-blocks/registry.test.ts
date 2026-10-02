import { describe, expect, it } from "vitest";
import { WELCOME_BLOCK_TYPES, type WelcomeBlockType } from "@/types/welcome-blocks";
import {
  BLOCK_REGISTRY,
  getBlockDefinition,
  createDefaultBlock,
} from "./registry";

describe("Welcome Blocks Registry", () => {
  it("registers every block type defined in WELCOME_BLOCK_TYPES", () => {
    for (const type of WELCOME_BLOCK_TYPES) {
      expect(BLOCK_REGISTRY[type]).toBeDefined();
      expect(BLOCK_REGISTRY[type].type).toBe(type);
    }
    expect(Object.keys(BLOCK_REGISTRY).sort()).toEqual([...WELCOME_BLOCK_TYPES].sort());
  });

  it("provides valid metadata for each registry entry", () => {
    for (const type of WELCOME_BLOCK_TYPES) {
      const def = BLOCK_REGISTRY[type];
      expect(typeof def.label).toBe("string");
      expect(def.label.trim().length).toBeGreaterThan(0);

      expect(typeof def.description).toBe("string");
      expect(def.description.trim().length).toBeGreaterThan(0);

      expect(typeof def.icon).toBe("string");
      expect(def.icon.trim().length).toBeGreaterThan(0);

      expect(typeof def.createDefaultContent).toBe("function");
      const defaultContent = def.createDefaultContent();
      expect(defaultContent).toBeDefined();
      expect(typeof defaultContent).toBe("object");
    }
  });

  it("getBlockDefinition returns the definition for valid types and undefined for unknown types", () => {
    for (const type of WELCOME_BLOCK_TYPES) {
      const def = getBlockDefinition(type);
      expect(def).toBeDefined();
      expect(def?.type).toBe(type);
    }

    expect(getBlockDefinition("unknown_type" as unknown as WelcomeBlockType)).toBeUndefined();
    expect(getBlockDefinition("")).toBeUndefined();
  });

  it("createDefaultBlock returns a block with id, type, displayOrder 0, and default content", () => {
    for (const type of WELCOME_BLOCK_TYPES) {
      const block = createDefaultBlock(type);
      expect(block.id).toBeDefined();
      expect(typeof block.id).toBe("string");
      expect(block.id.length).toBeGreaterThan(0);
      expect(block.type).toBe(type);
      expect(block.displayOrder).toBe(0);
      expect(block.content).toEqual(BLOCK_REGISTRY[type].createDefaultContent());
    }
  });

  it("createDefaultBlock respects custom displayOrder parameter", () => {
    const block = createDefaultBlock("heading", 4);
    expect(block.displayOrder).toBe(4);
    expect(block.type).toBe("heading");
  });

  it("createDefaultBlock throws when asked to create an unknown block type", () => {
    expect(() => createDefaultBlock("invalid_block" as unknown as WelcomeBlockType)).toThrow();
  });
});
