import { describe, it, expect, beforeEach } from "vitest";
import {
  getWelcomeHub,
  getWelcomeHubBlocks,
  saveWelcomeHubBlocks,
  cloneCompanyHubToGuide,
  resetGuideHubToCompany,
  resetFakeWelcomeHubStore,
} from "./welcomeHub";
import type { StudioActor } from "./types";
import { StudioPermissionError } from "./types";
import type { WelcomeBlock } from "@/types/welcome-blocks";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY_ID = "33333333-3333-3333-3333-333333333333";
const GUIDE_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_GUIDE_ID = "44444444-4444-4444-4444-444444444444";

const adminActor: StudioActor = { role: "admin" };
const companyActor: StudioActor = { role: "company", companyId: COMPANY_ID };
const otherCompanyActor: StudioActor = { role: "company", companyId: OTHER_COMPANY_ID };
const guideActor: StudioActor = { role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID };
const otherGuideActor: StudioActor = { role: "guide", companyId: COMPANY_ID, guideId: OTHER_GUIDE_ID };

const sampleCompanyBlocks: WelcomeBlock[] = [
  {
    id: "comp-block-1",
    type: "heading",
    displayOrder: 0,
    content: { text: "Company Welcome", level: 2 },
  },
  {
    id: "comp-block-2",
    type: "paragraph",
    displayOrder: 1,
    content: { text: "Enjoy your stay in Amsterdam!" },
  },
];

const sampleGuideBlocks: WelcomeBlock[] = [
  {
    id: "guide-block-1",
    type: "guide_hero",
    displayOrder: 0,
    content: { title: "Hoi van Jan!", greeting: "Bedankt voor de tour!", showAvatar: true },
  },
  {
    id: "guide-block-2",
    type: "quote",
    displayOrder: 1,
    content: { quote: "De mooiste stad van de wereld." },
  },
];

describe("welcomeHub data access layer", () => {
  beforeEach(() => {
    resetFakeWelcomeHubStore();
  });

  describe("getWelcomeHubBlocks", () => {
    it("returns fallback auto-generated blocks when neither guide hub nor company hub exists", async () => {
      const blocks = await getWelcomeHubBlocks(COMPANY_ID, GUIDE_ID);

      expect(blocks).toHaveLength(4);
      expect(blocks[0].type).toBe("guide_hero");
      expect(blocks[0].content).toEqual({
        title: "Welkom!",
        greeting: "Bedankt voor je bezoek!",
        showAvatar: true,
      });

      expect(blocks[1].type).toBe("review_card");
      expect(blocks[1].content).toEqual({
        promptText: "Laat een review achter",
        platforms: ["google", "tripadvisor"],
      });

      expect(blocks[2].type).toBe("category_shortcuts");
      expect(blocks[2].content).toEqual({
        categoryKeys: ["lunch", "dinner", "drinks"],
      });

      expect(blocks[3].type).toBe("tip_box");
      expect(blocks[3].content).toEqual({
        title: "Lokale tip",
        body: "Vergeet je fiets niet op slot te zetten!",
        style: "tip",
      });

      expect(blocks.map((b) => b.displayOrder)).toEqual([0, 1, 2, 3]);
    });

    it("returns company default blocks when company hub exists and guideId is not provided (or guide has no override)", async () => {
      await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, sampleCompanyBlocks);

      // Without guideId
      const companyBlocks = await getWelcomeHubBlocks(COMPANY_ID);
      expect(companyBlocks).toHaveLength(2);
      expect(companyBlocks[0].type).toBe("heading");
      expect(companyBlocks[1].type).toBe("paragraph");

      // With guideId but no guide override exists
      const fallbackToCompanyBlocks = await getWelcomeHubBlocks(COMPANY_ID, GUIDE_ID);
      expect(fallbackToCompanyBlocks).toHaveLength(2);
      expect(fallbackToCompanyBlocks[0].type).toBe("heading");
      expect(fallbackToCompanyBlocks[1].type).toBe("paragraph");
    });

    it("returns guide-specific blocks when guide hub exists", async () => {
      await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, sampleCompanyBlocks);
      await saveWelcomeHubBlocks(guideActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks);

      const blocks = await getWelcomeHubBlocks(COMPANY_ID, GUIDE_ID);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("guide_hero");
      expect(blocks[1].type).toBe("quote");
    });

    it("if guide hub has is_active: false, falls back to company default hub (or fallback blocks)", async () => {
      // With company hub existing
      await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, sampleCompanyBlocks);
      await saveWelcomeHubBlocks(guideActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks, {
        isActive: false,
      });

      const blocksWithCompanyFallback = await getWelcomeHubBlocks(COMPANY_ID, GUIDE_ID);
      expect(blocksWithCompanyFallback).toHaveLength(2);
      expect(blocksWithCompanyFallback[0].type).toBe("heading");

      // Without company hub existing, falls back to standard fallback blocks
      resetFakeWelcomeHubStore();
      await saveWelcomeHubBlocks(adminActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks, {
        isActive: false,
      });
      const blocksWithGeneratedFallback = await getWelcomeHubBlocks(COMPANY_ID, GUIDE_ID);
      expect(blocksWithGeneratedFallback).toHaveLength(4);
      expect(blocksWithGeneratedFallback[0].type).toBe("guide_hero");
    });

    it("blocks are returned strictly sorted by displayOrder", async () => {
      const unsortedBlocks: WelcomeBlock[] = [
        {
          id: "b-2",
          type: "paragraph",
          displayOrder: 5,
          content: { text: "Second" },
        },
        {
          id: "b-1",
          type: "heading",
          displayOrder: 2,
          content: { text: "First", level: 2 },
        },
      ];

      await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, unsortedBlocks);
      const blocks = await getWelcomeHubBlocks(COMPANY_ID);

      expect(blocks[0].displayOrder).toBe(0);
      expect(blocks[1].displayOrder).toBe(1);
      expect(blocks[0].type).toBe("paragraph");
      expect(blocks[1].type).toBe("heading");
    });
  });

  describe("getWelcomeHub", () => {
    it("returns null when no hub exists", async () => {
      const hub = await getWelcomeHub(COMPANY_ID, GUIDE_ID);
      expect(hub).toBeNull();
    });

    it("returns guide hub when active guide hub exists", async () => {
      await saveWelcomeHubBlocks(guideActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks, {
        title: "Jan's Welkomstpagina",
      });

      const hub = await getWelcomeHub(COMPANY_ID, GUIDE_ID);
      expect(hub).not.toBeNull();
      expect(hub?.guideId).toBe(GUIDE_ID);
      expect(hub?.title).toBe("Jan's Welkomstpagina");
      expect(hub?.blocks).toHaveLength(2);
    });

    it("falls back to company hub when guide hub is inactive", async () => {
      await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, sampleCompanyBlocks, {
        title: "Company Template",
      });
      await saveWelcomeHubBlocks(guideActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks, {
        isActive: false,
      });

      const hub = await getWelcomeHub(COMPANY_ID, GUIDE_ID);
      expect(hub).not.toBeNull();
      expect(hub?.guideId).toBeNull();
      expect(hub?.title).toBe("Company Template");
    });
  });

  describe("saveWelcomeHubBlocks", () => {
    it("admin actor can save company default hub and guide hub", async () => {
      const companyHub = await saveWelcomeHubBlocks(adminActor, COMPANY_ID, null, sampleCompanyBlocks);
      expect(companyHub.companyId).toBe(COMPANY_ID);
      expect(companyHub.guideId).toBeNull();

      const guideHub = await saveWelcomeHubBlocks(adminActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks);
      expect(guideHub.companyId).toBe(COMPANY_ID);
      expect(guideHub.guideId).toBe(GUIDE_ID);
    });

    it("company actor can save their own company default hub and any guide in their company, but rejects saving for a different company", async () => {
      // Allowed for own company
      const companyHub = await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, sampleCompanyBlocks);
      expect(companyHub.companyId).toBe(COMPANY_ID);

      const guideHub = await saveWelcomeHubBlocks(companyActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks);
      expect(guideHub.guideId).toBe(GUIDE_ID);

      // Rejected for different company
      await expect(
        saveWelcomeHubBlocks(companyActor, OTHER_COMPANY_ID, null, sampleCompanyBlocks),
      ).rejects.toThrow(StudioPermissionError);

      await expect(
        saveWelcomeHubBlocks(companyActor, OTHER_COMPANY_ID, GUIDE_ID, sampleGuideBlocks),
      ).rejects.toThrow(StudioPermissionError);
    });

    it("guide actor can save their own guide hub, but rejects saving company default hub or another guide's hub", async () => {
      // Allowed for own guide hub
      const hub = await saveWelcomeHubBlocks(guideActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks);
      expect(hub.guideId).toBe(GUIDE_ID);

      // Rejected for company default hub
      await expect(
        saveWelcomeHubBlocks(guideActor, COMPANY_ID, null, sampleCompanyBlocks),
      ).rejects.toThrow(StudioPermissionError);

      // Rejected for another guide's hub
      await expect(
        saveWelcomeHubBlocks(guideActor, COMPANY_ID, OTHER_GUIDE_ID, sampleGuideBlocks),
      ).rejects.toThrow(StudioPermissionError);

      // Rejected for another company
      await expect(
        saveWelcomeHubBlocks(guideActor, OTHER_COMPANY_ID, GUIDE_ID, sampleGuideBlocks),
      ).rejects.toThrow(StudioPermissionError);
    });

    it("upserts hub and replaces all blocks with sequential displayOrder = index", async () => {
      const initialHub = await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, sampleCompanyBlocks, {
        title: "Initial Title",
      });
      expect(initialHub.blocks).toHaveLength(2);
      expect(initialHub.blocks?.[0].displayOrder).toBe(0);
      expect(initialHub.blocks?.[1].displayOrder).toBe(1);

      const replacementBlocks: WelcomeBlock[] = [
        {
          id: "new-1",
          type: "tip_box",
          displayOrder: 99,
          content: { title: "Tip", body: "Check this out", style: "tip" },
        },
      ];

      const updatedHub = await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, replacementBlocks, {
        title: "Updated Title",
      });

      expect(updatedHub.id).toBe(initialHub.id);
      expect(updatedHub.title).toBe("Updated Title");
      expect(updatedHub.blocks).toHaveLength(1);
      expect(updatedHub.blocks?.[0].type).toBe("tip_box");
      expect(updatedHub.blocks?.[0].displayOrder).toBe(0);
    });
  });

  describe("cloneCompanyHubToGuide", () => {
    it("copies company default blocks into a new guide hub for guideId", async () => {
      await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, sampleCompanyBlocks, {
        title: "Company Template",
        intro: "Welcome intro",
      });

      const clonedHub = await cloneCompanyHubToGuide(guideActor, COMPANY_ID, GUIDE_ID);
      expect(clonedHub.companyId).toBe(COMPANY_ID);
      expect(clonedHub.guideId).toBe(GUIDE_ID);
      expect(clonedHub.title).toBe("Company Template");
      expect(clonedHub.intro).toBe("Welcome intro");
      expect(clonedHub.blocks).toHaveLength(2);

      // Verify block IDs are newly generated copies
      expect(clonedHub.blocks?.[0].id).not.toBe(sampleCompanyBlocks[0].id);
      expect(clonedHub.blocks?.[0].content).toEqual(sampleCompanyBlocks[0].content);

      // Modifying company template later should not affect cloned guide blocks
      await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, []);
      const guideBlocks = await getWelcomeHubBlocks(COMPANY_ID, GUIDE_ID);
      expect(guideBlocks).toHaveLength(2);
    });

    it("if company default has no hub yet, copies the default auto-generated fallback blocks", async () => {
      const clonedHub = await cloneCompanyHubToGuide(guideActor, COMPANY_ID, GUIDE_ID);
      expect(clonedHub.companyId).toBe(COMPANY_ID);
      expect(clonedHub.guideId).toBe(GUIDE_ID);
      expect(clonedHub.blocks).toHaveLength(4);
      expect(clonedHub.blocks?.[0].type).toBe("guide_hero");
      expect(clonedHub.blocks?.[1].type).toBe("review_card");
    });

    it("enforces permissions for cloning", async () => {
      await expect(
        cloneCompanyHubToGuide(otherCompanyActor, COMPANY_ID, GUIDE_ID),
      ).rejects.toThrow(StudioPermissionError);

      await expect(
        cloneCompanyHubToGuide(otherGuideActor, COMPANY_ID, GUIDE_ID),
      ).rejects.toThrow(StudioPermissionError);
    });
  });

  describe("resetGuideHubToCompany", () => {
    it("deletes the guide-specific hub, causing getWelcomeHubBlocks(companyId, guideId) to fall back to company default", async () => {
      await saveWelcomeHubBlocks(companyActor, COMPANY_ID, null, sampleCompanyBlocks);
      await saveWelcomeHubBlocks(guideActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks);

      // Initially returns guide blocks
      let blocks = await getWelcomeHubBlocks(COMPANY_ID, GUIDE_ID);
      expect(blocks[0].type).toBe("guide_hero");

      // Reset
      await resetGuideHubToCompany(guideActor, COMPANY_ID, GUIDE_ID);

      // Now falls back to company default
      blocks = await getWelcomeHubBlocks(COMPANY_ID, GUIDE_ID);
      expect(blocks[0].type).toBe("heading");
      expect(blocks).toHaveLength(2);
    });

    it("enforces permissions for reset", async () => {
      await saveWelcomeHubBlocks(guideActor, COMPANY_ID, GUIDE_ID, sampleGuideBlocks);

      await expect(
        resetGuideHubToCompany(otherGuideActor, COMPANY_ID, GUIDE_ID),
      ).rejects.toThrow(StudioPermissionError);

      await expect(
        resetGuideHubToCompany(otherCompanyActor, COMPANY_ID, GUIDE_ID),
      ).rejects.toThrow(StudioPermissionError);
    });
  });
});
