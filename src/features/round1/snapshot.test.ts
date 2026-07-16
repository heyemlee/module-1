import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import { buildFloorPlan, type PositionOverrides } from "./floorplan/plan-geometry";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import {
  ROUND1_SNAPSHOT_SCHEMA_VERSION,
  buildRound1Snapshot,
  floorPlanWithMeasurementPresets,
  summarizeRound1Snapshot
} from "./snapshot";
import type { Round1FormInput } from "@/domain/round1";

const FIXED_NOW = new Date("2026-06-17T12:00:00.000Z");

function buildFixtureSnapshot(positionOverrides: PositionOverrides = {}) {
  const form = createDefaultShowroomForm();
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  const confirmationItems = [
    ...result.confirmationItems,
    ...estimate.confirmationItems
  ];

  const snapshot = buildRound1Snapshot({
    showroomForm: form,
    normalized: result.normalized,
    positionOverrides,
    preliminaryCabinets: estimate,
    confirmationItems,
    readiness: result.readiness,
    now: () => FIXED_NOW
  });

  return { form, result, estimate, confirmationItems, snapshot };
}

describe("buildRound1Snapshot", () => {
  test("freezes the gating flags and Round 1 metadata flags", () => {
    const { snapshot } = buildFixtureSnapshot();

    expect(snapshot.schemaVersion).toBe(ROUND1_SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(snapshot.fixedPositionsConfirmed).toBe(true);
    expect(snapshot.cabinetFillGenerated).toBe(true);
    expect(snapshot.salesEstimateOnly).toBe(true);
    expect(snapshot.notForProduction).toBe(true);
    expect(snapshot.dimensionConfidence).toBe("ROUGH");
  });

  test("captures the form, normalized data, cabinets, confirmations and readiness", () => {
    const { form, result, estimate, confirmationItems, snapshot } =
      buildFixtureSnapshot();

    expect(snapshot.showroomForm).toEqual(form);
    expect(snapshot.normalized).toEqual(result.normalized);
    expect(snapshot.preliminaryCabinets).toEqual(estimate);
    expect(snapshot.confirmationItems).toEqual(confirmationItems);
    expect(snapshot.readiness).toEqual(result.readiness);
  });

  test("embeds a deterministic floor plan matching buildFloorPlan", () => {
    const { snapshot } = buildFixtureSnapshot();

    const rebuilt = buildFloorPlan(
      snapshot.normalized,
      snapshot.preliminaryCabinets.cabinets,
      snapshot.confirmationItems.length,
      snapshot.positionOverrides
    );

    expect(snapshot.floorPlan).toEqual(rebuilt);
  });

  test("captured inputs are enough to rebuild the geometry after a drag override", () => {
    const overrides: PositionOverrides = {
      sink: { wall: "TOP", position: 240 }
    };
    const { snapshot } = buildFixtureSnapshot(overrides);

    expect(snapshot.positionOverrides).toEqual(overrides);
    expect(snapshot.floorPlan).toEqual(
      buildFloorPlan(
        snapshot.normalized,
        snapshot.preliminaryCabinets.cabinets,
        snapshot.confirmationItems.length,
        overrides
      )
    );
  });

  test("copies rendering preferences into the snapshot audit context", () => {
    const form = createDefaultShowroomForm();
    form.renderingPreferences = {
      cabinetStyle: "AMERICAN_FRAMED",
      doorColorId: "painted-white"
    };
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const snapshot = buildRound1Snapshot({
      showroomForm: form,
      normalized: result.normalized,
      positionOverrides: {},
      preliminaryCabinets: estimate,
      confirmationItems: [...result.confirmationItems, ...estimate.confirmationItems],
      readiness: result.readiness,
      now: () => new Date("2026-06-19T12:00:00.000Z")
    });

    form.renderingPreferences.doorColorId = null;
    form.renderingPreferences.cabinetStyle = "EUROPEAN_FRAMELESS";

    expect(snapshot.showroomForm.renderingPreferences).toEqual({
      cabinetStyle: "AMERICAN_FRAMED",
      doorColorId: "painted-white"
    });
  });
});

describe("floorPlanWithMeasurementPresets", () => {
  function snapshotForRoom(
    room: Partial<Round1FormInput["room"]>
  ) {
    const base = createDefaultShowroomForm();
    const form: Round1FormInput = {
      ...base,
      room: { ...base.room, ...room }
    };
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(
      createDefaultCabinetRuns(form)
    );
    return buildRound1Snapshot({
      showroomForm: form,
      normalized: result.normalized,
      positionOverrides: {},
      preliminaryCabinets: estimate,
      confirmationItems: [],
      readiness: result.readiness,
      now: () => FIXED_NOW
    });
  }

  test("recovers pxPerInch and ceiling for a snapshot serialized without them", () => {
    const snapshot = snapshotForRoom({
      length: 120,
      width: 108,
      dimensionsKnown: true,
      ceilingHeight: 96
    });
    // Emulate a snapshot stored before the plan carried these fields.
    const legacy = {
      ...snapshot,
      floorPlan: {
        ...snapshot.floorPlan,
        pxPerInch: null,
        ceilingHeightSixteenths: null
      }
    };

    const recovered = floorPlanWithMeasurementPresets(legacy);

    expect(recovered.pxPerInch).toBeCloseTo(snapshot.floorPlan.room.w / 120, 5);
    expect(recovered.ceilingHeightSixteenths).toBe(96 * 16);
  });

  test("keeps a plan that already carries the presets untouched", () => {
    const snapshot = snapshotForRoom({
      length: 120,
      width: 108,
      dimensionsKnown: true,
      ceilingHeight: 96
    });
    expect(snapshot.floorPlan.pxPerInch).toBeGreaterThan(0);
    expect(floorPlanWithMeasurementPresets(snapshot)).toBe(snapshot.floorPlan);
  });

  test("leaves the scale null when room dimensions are unknown, still recovering a known ceiling", () => {
    const snapshot = snapshotForRoom({
      length: null,
      width: null,
      dimensionsKnown: false,
      ceilingHeight: 96
    });
    const legacy = {
      ...snapshot,
      floorPlan: {
        ...snapshot.floorPlan,
        pxPerInch: null,
        ceilingHeightSixteenths: null
      }
    };

    const recovered = floorPlanWithMeasurementPresets(legacy);

    expect(recovered.pxPerInch).toBeNull();
    expect(recovered.ceilingHeightSixteenths).toBe(96 * 16);
  });
});

describe("summarizeRound1Snapshot", () => {
  test("reports cabinet, confirmation and filler counts consistent with the snapshot", () => {
    const { snapshot } = buildFixtureSnapshot();
    const summary = summarizeRound1Snapshot(snapshot);

    const cabinets = snapshot.preliminaryCabinets.cabinets;
    expect(summary.totalCabinets).toBe(cabinets.length);
    expect(summary.baseCabinets + summary.wallCabinets + summary.tallCabinets).toBe(
      cabinets.length
    );
    expect(summary.baseCabinets).toBeGreaterThan(0);
    expect(summary.wallCabinets).toBeGreaterThan(0);
    expect(summary.confirmationCount).toBe(snapshot.confirmationItems.length);
    expect(summary.estimatedFillerWidth).toBe(
      snapshot.preliminaryCabinets.estimatedFillerWidth
    );
  });
});
