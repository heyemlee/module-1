import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import { buildFloorPlan } from "./floorplan/plan-geometry";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import { ROUND1_SNAPSHOT_SCHEMA_VERSION, buildRound1Snapshot } from "./snapshot";

/**
 * Full-flow ("一条龙") smoke for the deterministic Round 1 pipeline:
 *   form → normalize → preliminary cabinets → snapshot → geometry → restore.
 *
 * Each scenario is one complete intake for a representative kitchen (the golden
 * set / Phase 0 spine of docs/ai-eval-plan.md). Per scenario we assert the
 * universal "没问题" invariants (safety flags frozen, cabinets produced, geometry
 * rebuildable, snapshot serializable & lossless) plus a layout-shape check so
 * each flow is genuinely distinct.
 *
 * Scope: deterministic data path ONLY. Browser/drag/visual fidelity and the real
 * OpenAI rendering are inherently manual — see docs/launch-manual-test-plan.md
 * (§6 渲染效果, §5.5 cards). This file is the cheap regression net under them.
 */

const FIXED_NOW = new Date("2026-06-24T12:00:00.000Z");

function withLayout(
  pref: Round1FormInput["layoutPreference"]
): Round1FormInput {
  return { ...createDefaultShowroomForm(), layoutPreference: pref };
}

function withIsland(
  pref: Round1FormInput["layoutPreference"]
): Round1FormInput {
  const form = withLayout(pref);
  return {
    ...form,
    layoutSensitiveCabinets: {
      ...form.layoutSensitiveCabinets,
      island: { status: "YES", requested: true, functions: [] }
    }
  };
}

type Scenario = {
  name: string;
  form: Round1FormInput;
  expectRunLocations?: string[];
  forbidRunLocations?: string[];
};

const SCENARIOS: Scenario[] = [
  {
    name: "one-wall",
    form: withLayout("ONE_WALL"),
    expectRunLocations: ["ON_MAIN_RUN"],
    forbidRunLocations: ["LEFT_SIDE", "RIGHT_SIDE", "ON_ISLAND"]
  },
  {
    name: "galley",
    form: withLayout("GALLEY"),
    expectRunLocations: ["ON_MAIN_RUN", "FRONT_SIDE"],
    forbidRunLocations: ["LEFT_SIDE", "RIGHT_SIDE"]
  },
  {
    name: "left-L",
    form: withLayout("LEFT_L_SHAPE"),
    expectRunLocations: ["ON_MAIN_RUN", "LEFT_SIDE"],
    forbidRunLocations: ["RIGHT_SIDE"]
  },
  {
    name: "right-L",
    form: withLayout("RIGHT_L_SHAPE"),
    expectRunLocations: ["ON_MAIN_RUN", "RIGHT_SIDE"],
    forbidRunLocations: ["LEFT_SIDE"]
  },
  {
    name: "U-shape",
    form: withLayout("U_SHAPE"),
    expectRunLocations: ["ON_MAIN_RUN", "LEFT_SIDE", "RIGHT_SIDE"]
  },
  {
    name: "peninsula",
    form: withLayout("PENINSULA"),
    expectRunLocations: ["ON_MAIN_RUN", "LEFT_SIDE", "FRONT_SIDE"]
  },
  {
    name: "U-shape + island",
    form: withIsland("U_SHAPE"),
    expectRunLocations: ["ON_MAIN_RUN", "LEFT_SIDE", "RIGHT_SIDE", "ON_ISLAND"]
  },
  {
    name: "tiny room (edge dims, no preference)",
    form: { ...withLayout("NO_PREFERENCE"), room: { length: 84, width: 72, dimensionsKnown: false, ceilingHeight: null, obstacles: [] } },
    expectRunLocations: ["ON_MAIN_RUN"]
  }
];

function runFullFlow(form: Round1FormInput) {
  const result = normalizeRound1Form(form);
  const runs = createDefaultCabinetRuns(form);
  const estimate = generatePreliminaryCabinetList(runs);
  const confirmationItems = [
    ...result.confirmationItems,
    ...estimate.confirmationItems
  ];
  const snapshot = buildRound1Snapshot({
    showroomForm: form,
    normalized: result.normalized,
    positionOverrides: {},
    preliminaryCabinets: estimate,
    confirmationItems,
    readiness: result.readiness,
    now: () => FIXED_NOW
  });
  return { result, runs, estimate, confirmationItems, snapshot };
}

describe("Round 1 full flow (per scenario)", () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.name}: produces a valid, frozen, restorable snapshot`, () => {
      const { runs, estimate, snapshot } = runFullFlow(scenario.form);

      // 1. Round 1 safety invariants are frozen on every output.
      expect(snapshot.salesEstimateOnly).toBe(true);
      expect(snapshot.notForProduction).toBe(true);
      expect(snapshot.dimensionConfidence).toBe("ROUGH");
      expect(snapshot.fixedPositionsConfirmed).toBe(true);
      expect(snapshot.cabinetFillGenerated).toBe(true);
      expect(snapshot.schemaVersion).toBe(ROUND1_SNAPSHOT_SCHEMA_VERSION);

      // 2. The flow captures the exact input form and produces base cabinets.
      expect(snapshot.showroomForm).toEqual(scenario.form);
      const baseCount = estimate.cabinets.filter((c) => c.kind === "BASE").length;
      expect(baseCount).toBeGreaterThan(0);

      // 3. Geometry is deterministic & self-consistent: the stored floor plan
      //    rebuilds exactly from the captured inputs (the restore guarantee).
      expect(snapshot.floorPlan).toEqual(
        buildFloorPlan(
          snapshot.normalized,
          snapshot.preliminaryCabinets.cabinets,
          snapshot.confirmationItems.length,
          snapshot.positionOverrides
        )
      );

      // 4. Unknown/edge inputs surface as confirmation items, never crash.
      expect(Array.isArray(snapshot.confirmationItems)).toBe(true);

      // 5. Persist → restore proxy: serializable and lossless (P0-04 data path).
      const restored = JSON.parse(JSON.stringify(snapshot));
      expect(restored.salesEstimateOnly).toBe(true);
      expect(restored.cabinetFillGenerated).toBe(true);
      expect(restored.preliminaryCabinets.cabinets.length).toBe(
        snapshot.preliminaryCabinets.cabinets.length
      );
      expect(restored.floorPlan).toEqual(snapshot.floorPlan);

      // 6. Layout shape is distinct per scenario (proves it's a real full flow).
      const locations = runs.map((run) => run.location);
      for (const loc of scenario.expectRunLocations ?? []) {
        expect(locations).toContain(loc);
      }
      for (const loc of scenario.forbidRunLocations ?? []) {
        expect(locations).not.toContain(loc);
      }
    });
  }

  test("editing a layout field changes the generated geometry (staleness has teeth)", () => {
    const oneWall = runFullFlow(withLayout("ONE_WALL"));
    const uShape = runFullFlow(withLayout("U_SHAPE"));
    // Different layout → different cabinet set → different frozen geometry.
    expect(uShape.estimate.cabinets.length).not.toBe(
      oneWall.estimate.cabinets.length
    );
    expect(uShape.snapshot.floorPlan).not.toEqual(oneWall.snapshot.floorPlan);
  });

  // Dialogue scenario 1 (docs/test-dialogues.md): "大平层", feet typed as inches.
  test("oversized room dimensions are clamped + flagged, not turned into absurd geometry", () => {
    const huge: Round1FormInput = {
      ...withLayout("U_SHAPE"),
      room: {
        length: 12000,
        width: 8000,
        dimensionsKnown: true,
        ceilingHeight: null,
        obstacles: []
      }
    };
    const { result, snapshot } = runFullFlow(huge);

    // clamped to the realistic ceiling, never the raw 12000"/8000"
    expect(snapshot.normalized.room.length.value).toBeLessThanOrEqual(600);
    expect(snapshot.normalized.room.width.value).toBeLessThanOrEqual(600);
    // surfaced as a confirmation item, not silently swallowed
    expect(
      result.confirmationItems.some(
        (item) => item.code === "ROOM_DIMENSION_OUT_OF_RANGE"
      )
    ).toBe(true);
    // and still a valid, frozen, rough snapshot
    expect(snapshot.salesEstimateOnly).toBe(true);
    expect(snapshot.dimensionConfidence).toBe("ROUGH");
  });
});
