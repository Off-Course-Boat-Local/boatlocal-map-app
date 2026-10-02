import { describe, expect, it } from "vitest";
import {
  WELCOME_BLOCK_TYPES,
  isWelcomeBlockType,
  type WelcomeBlockType,
} from "@/types/welcome-blocks";
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
      expect(isWelcomeBlockType(type)).toBe(true);
    }
    expect(isWelcomeBlockType("unknown_block")).toBe(false);
    expect(isWelcomeBlockType("")).toBe(false);
    expect(isWelcomeBlockType(null)).toBe(false);
    expect(isWelcomeBlockType(123)).toBe(false);
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

  it("getBlockDefinition returns the definition for valid types and undefined for unknown or prototype types", () => {
    for (const type of WELCOME_BLOCK_TYPES) {
      const def = getBlockDefinition(type);
      expect(def).toBeDefined();
      expect(def?.type).toBe(type);
    }

    expect(getBlockDefinition("unknown_type")).toBeUndefined();
    expect(getBlockDefinition("")).toBeUndefined();
    expect(getBlockDefinition("toString")).toBeUndefined();
    expect(getBlockDefinition("constructor")).toBeUndefined();
    expect(getBlockDefinition("valueOf")).toBeUndefined();
  });

  it("createDefaultBlock returns a block with valid UUID, type, displayOrder 0, and default content", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const type of WELCOME_BLOCK_TYPES) {
      const block = createDefaultBlock(type);
      expect(block.id).toBeDefined();
      expect(block.id).toMatch(uuidRegex);
      expect(block.type).toBe(type);
      expect(block.displayOrder).toBe(0);
      expect(block.content).toEqual(BLOCK_REGISTRY[type].createDefaultContent());
    }

    const b1 = createDefaultBlock("heading");
    const b2 = createDefaultBlock("heading");
    expect(b1.id).not.toBe(b2.id);
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
