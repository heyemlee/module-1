import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "@/features/round1/showroom-intake-data";
import { buildFloorPlan } from "@/features/round1/floorplan/plan-geometry";
import type { Round1Snapshot } from "@/features/round1/snapshot";
import {
  buildExpectedInventory,
  buildVerificationPrompt,
  verifyConceptRendering,
  type VisionClient
} from "./rendering-verification";

function snapshotForLayout(
  layoutPreference: Round1FormInput["layoutPreference"]
): Round1Snapshot {
  const base = createDefaultShowroomForm();
  const form: Round1FormInput = {
    ...base,
    layoutPreference,
    openings: {
      doors: { status: "YES", items: [{ location: "LEFT_SIDE" }] },
      windows: { status: "YES", items: [{ relation: "BEHIND_SINK", width: null }] }
    },
    fixtures: {
      ...base.fixtures,
      sink: { ...base.fixtures.sink, relation: "UNDER_WINDOW" }
    }
  };
  const { normalized } = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  const floorPlan = buildFloorPlan(normalized, estimate.cabinets, 3, {});
  // buildExpectedInventory only reads floorPlan + normalized.layoutPreference.
  return { normalized, floorPlan } as unknown as Round1Snapshot;
}

describe("buildExpectedInventory", () => {
  test("captures window, door, and per-wall appliances from the plan", () => {
    const inventory = buildExpectedInventory(snapshotForLayout("LEFT_L_SHAPE"));
    expect(inventory.window).toBeTruthy();
    expect(inventory.door).toBeTruthy();
    expect(inventory.appliancesByWall.flatMap((w) => w.items).length).toBeGreaterThan(0);
  });

  test("verification prompt enumerates contents and asks for OK", () => {
    const prompt = buildVerificationPrompt(
      buildExpectedInventory(snapshotForLayout("LEFT_L_SHAPE"))
    );
    expect(prompt).toContain("window:");
    expect(prompt).toMatch(/reply with only: OK/i);
  });
});

describe("verifyConceptRendering", () => {
  const snapshot = snapshotForLayout("LEFT_L_SHAPE");

  test("passes when the model replies OK", async () => {
    const client: VisionClient = { analyze: async () => "OK" };
    const result = await verifyConceptRendering({ imageBase64: "x", snapshot, client });
    expect(result.ok).toBe(true);
    expect(result.discrepancies).toEqual([]);
  });

  test("parses discrepancy lines into a clean list", async () => {
    const client: VisionClient = {
      analyze: async () => "- extra microwave on the back wall\n- sink missing"
    };
    const result = await verifyConceptRendering({ imageBase64: "x", snapshot, client });
    expect(result.ok).toBe(false);
    expect(result.discrepancies).toEqual([
      "extra microwave on the back wall",
      "sink missing"
    ]);
  });
});
