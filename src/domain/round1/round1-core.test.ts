import { describe, expect, test } from "vitest";
import {
  createCabinetCode,
  createStandardCabinet,
  applyCabinetReviewActions,
  generatePreliminaryCabinetList,
  summarizePreliminaryCabinetEstimate,
  normalizeRound1Form,
  round1NormalizedSchema,
  splitCabinetRun
} from "./index";

describe("Round 1 cabinet code helpers", () => {
  test("generates wall and base cabinet codes with base actual height rounded for code height", () => {
    expect(createCabinetCode("WALL", 30, 12, 36)).toBe("W301236");
    expect(createCabinetCode("BASE", 30, 24, 34.5)).toBe("B302435");

    expect(createStandardCabinet("BASE", 30)).toMatchObject({
      kind: "BASE",
      width: 30,
      depth: 24,
      actualHeight: 34.5,
      codeHeight: 35,
      code: "B302435",
      preliminary: true,
      salesEstimateOnly: true,
      notForProduction: true
    });
  });

  test("flags non-standard cabinet sizes as confirmation required", () => {
    const cabinet = createStandardCabinet("WALL", 37);

    expect(cabinet.code).toBe("W371236");
    expect(cabinet.confirmationRequired).toBe(true);
    expect(cabinet.confirmationReasons).toContain("NON_STANDARD_CABINET_SIZE");
  });
});

describe("Round 1 standard cabinet run split", () => {
  test("splits a run using the confirmed width priority", () => {
    const split = splitCabinetRun({
      id: "main",
      kind: "BASE",
      width: 96,
      location: "ON_MAIN_RUN"
    });

    expect(split.cabinets.map((cabinet) => cabinet.width)).toEqual([
      36, 36, 24
    ]);
    expect(split.remainder).toBe(0);
    expect(split.confirmationItems).toHaveLength(0);
  });

  test("flags a remainder as confirmation required", () => {
    const split = splitCabinetRun({
      id: "main",
      kind: "BASE",
      width: 112,
      location: "ON_MAIN_RUN"
    });

    expect(split.cabinets.map((cabinet) => cabinet.width)).toEqual([
      36, 36, 36
    ]);
    expect(split.remainder).toBe(4);
    expect(split.confirmationItems[0]).toMatchObject({
      category: "CABINET",
      code: "RUN_REMAINDER",
      severity: "REQUIRED"
    });
  });

  test("treats a remainder up to 3 inches as estimated filler allowance", () => {
    const split = splitCabinetRun({
      id: "main",
      kind: "BASE",
      width: 101,
      location: "ON_MAIN_RUN"
    });

    expect(split.cabinets.map((cabinet) => cabinet.width)).toEqual([
      36, 36, 27
    ]);
    expect(split.remainder).toBe(0);
    expect(split.fillerWidth).toBe(2);
    expect(split.confirmationItems).toHaveLength(0);
  });

  test("flags remainders larger than 3 inches for confirmation", () => {
    const split = splitCabinetRun({
      id: "main",
      kind: "BASE",
      width: 112,
      location: "ON_MAIN_RUN"
    });

    expect(split.fillerWidth).toBe(0);
    expect(split.remainder).toBe(4);
    expect(split.confirmationItems[0]).toMatchObject({
      category: "CABINET",
      code: "RUN_REMAINDER",
      severity: "REQUIRED"
    });
  });
});

describe("Round 1 normalization and readiness", () => {
  test("normalizes showroom intake into sales-estimate-only rough JSON and flags unknowns", () => {
    const result = normalizeRound1Form({
      room: {
        length: 144,
        width: 120,
        dimensionsKnown: true,
        ceilingHeight: null,
        obstacles: []
      },
      openings: {
        doors: {
          status: "YES",
          items: [{ location: "NEAR_ENTRANCE", width: null }]
        },
        windows: {
          status: "YES",
          items: [{ relation: "BEHIND_SINK", width: null }]
        }
      },
      mep: {
        water: { relation: "NEAR_SINK", movable: "UNKNOWN" },
        gas: { relation: "NEAR_RANGE", movable: "UNKNOWN" },
        electric: { relation: "NEAR_FRIDGE", movable: "UNKNOWN" },
        vent: { relation: "ABOVE_RANGE", movable: "UNKNOWN" }
      },
      layoutPreference: "L_SHAPE",
      fixtures: {
        sink: { size: 33, type: "UNKNOWN", relation: "UNDER_WINDOW" },
        range: {
          size: 30,
          fuel: "GAS",
          fixedLocation: "UNKNOWN",
          relation: "NEAR_RANGE"
        },
        fridge: { size: null, type: "UNKNOWN", relation: "NEAR_ENTRANCE" },
        dishwasher: { status: "YES", size: 24, relation: "NEAR_SINK" },
        hood: { relation: "ABOVE_RANGE" }
      },
      layoutSensitiveCabinets: {
        cornerCabinet: { preferredType: "NO_PREFERENCE" },
        ovenMicrowave: { configuration: "UNKNOWN", relation: "UNKNOWN" },
        island: { requested: false, functions: [] }
      }
    });

    expect(round1NormalizedSchema.parse(result.normalized)).toMatchObject({
      round: "ROUND_1",
      layoutGoal: "CUSTOMER_CONFIRMATION",
      salesEstimateOnly: true,
      notForProduction: true,
      dimensionConfidence: "ROUGH"
    });
    expect(result.confirmationItems.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "MISSING_CEILING_HEIGHT",
        "MISSING_DOOR_WIDTH",
        "MISSING_WINDOW_WIDTH",
        "UNKNOWN_MEP_MOVABILITY",
        "MISSING_APPLIANCE_DIMENSION",
        "CORNER_CABINET_UNCONFIRMED"
      ])
    );
    expect(result.readiness.canGenerateRound1Layout).toBe(true);
    expect(result.readiness.canEnterProduction).toBe(false);
  });

  test("does not allow production readiness from Round 1 data", () => {
    const result = normalizeRound1Form({
      room: {
        length: 144,
        width: 120,
        dimensionsKnown: true,
        ceilingHeight: 96,
        obstacles: []
      },
      openings: {
        doors: { status: "NO", items: [] },
        windows: { status: "NO", items: [] }
      },
      mep: {
        water: { relation: "NEAR_SINK", movable: "NO" },
        gas: { relation: "NEAR_RANGE", movable: "NO" },
        electric: { relation: "NEAR_FRIDGE", movable: "NO" },
        vent: { relation: "ABOVE_RANGE", movable: "NO" }
      },
      layoutPreference: "ONE_WALL",
      fixtures: {
        sink: { size: 30, type: "SINGLE", relation: "ON_MAIN_RUN" },
        range: {
          size: 30,
          fuel: "GAS",
          fixedLocation: "YES",
          relation: "NEAR_RANGE"
        },
        fridge: { size: 36, type: "FRENCH_DOOR", relation: "NEAR_ENTRANCE" },
        dishwasher: { status: "YES", size: 24, relation: "NEAR_SINK" },
        hood: { relation: "ABOVE_RANGE" }
      },
      layoutSensitiveCabinets: {
        cornerCabinet: { preferredType: "NO_PREFERENCE" },
        ovenMicrowave: {
          configuration: "RANGE_INCLUDES_OVEN",
          relation: "NEAR_RANGE"
        },
        island: { requested: false, functions: [] }
      }
    });

    expect(result.readiness.canGenerateRound1Layout).toBe(true);
    expect(result.readiness.canEnterProduction).toBe(false);
    expect(result.readiness.productionRejectionReasons).toContain(
      "ROUND_1_NOT_PRODUCTION_DATA"
    );
  });
});

describe("Round 1 preliminary cabinet list", () => {
  test("generates preliminary base and wall cabinets from deterministic runs", () => {
    const estimate = generatePreliminaryCabinetList([
      { id: "base-main", kind: "BASE", width: 96, location: "ON_MAIN_RUN" },
      { id: "wall-main", kind: "WALL", width: 60, location: "ON_MAIN_RUN" }
    ]);

    expect(estimate.cabinets.map((cabinet) => cabinet.code)).toEqual([
      "B362435",
      "B362435",
      "B242435",
      "W361236",
      "W241236"
    ]);
    expect(estimate.salesEstimateOnly).toBe(true);
    expect(estimate.notForProduction).toBe(true);
    expect(estimate.confirmationItems).toHaveLength(0);
  });

  test("summarizes preliminary cabinet estimate for rough Round 1 sales review", () => {
    const estimate = generatePreliminaryCabinetList([
      { id: "base-main", kind: "BASE", width: 96, location: "ON_MAIN_RUN" },
      { id: "wall-main", kind: "WALL", width: 60, location: "ON_MAIN_RUN" }
    ]);

    const summary = summarizePreliminaryCabinetEstimate(estimate);

    expect(summary).toMatchObject({
      totalCabinets: 5,
      baseCabinets: { count: 3, linearFeet: 8 },
      wallCabinets: { count: 2, linearFeet: 5 },
      tallCabinets: { count: 0, linearFeet: 0 },
      estimatedFillerWidth: 0,
      salesEstimateOnly: true,
      notForProduction: true
    });
  });

  test("includes estimated filler allowance in rough summary", () => {
    const estimate = generatePreliminaryCabinetList([
      { id: "base-main", kind: "BASE", width: 101, location: "ON_MAIN_RUN" },
      { id: "wall-main", kind: "WALL", width: 62, location: "ON_MAIN_RUN" }
    ]);

    const summary = summarizePreliminaryCabinetEstimate(estimate);

    expect(summary.estimatedFillerWidth).toBe(4);
    expect(estimate.confirmationItems).toHaveLength(0);
  });

  test("lets designer review remove and add preliminary cabinets without production eligibility", () => {
    const estimate = generatePreliminaryCabinetList([
      { id: "base-main", kind: "BASE", width: 60, location: "ON_MAIN_RUN" }
    ]);

    const reviewed = applyCabinetReviewActions(estimate, [
      { type: "REMOVE", cabinetIndex: 0 },
      {
        type: "ADD",
        cabinet: {
          kind: "WALL",
          width: 30,
          location: "ON_MAIN_RUN"
        }
      }
    ]);

    expect(reviewed.cabinets.map((cabinet) => cabinet.code)).toEqual([
      "B242435",
      "W301236"
    ]);
    expect(reviewed.cabinets.every((cabinet) => cabinet.preliminary)).toBe(true);
    expect(reviewed.salesEstimateOnly).toBe(true);
    expect(reviewed.notForProduction).toBe(true);
  });

  test("flags designer manual non-standard cabinet edits as confirmation required", () => {
    const estimate = generatePreliminaryCabinetList([
      { id: "base-main", kind: "BASE", width: 36, location: "ON_MAIN_RUN" }
    ]);

    const reviewed = applyCabinetReviewActions(estimate, [
      {
        type: "EDIT",
        cabinetIndex: 0,
        cabinet: {
          kind: "BASE",
          width: 37,
          location: "ON_MAIN_RUN"
        }
      }
    ]);

    expect(reviewed.cabinets[0]).toMatchObject({
      code: "B372435",
      confirmationRequired: true,
      confirmationReasons: expect.arrayContaining([
        "NON_STANDARD_CABINET_SIZE",
        "DESIGNER_MANUAL_REVIEW"
      ]),
      salesEstimateOnly: true,
      notForProduction: true
    });
    expect(reviewed.confirmationItems[0]).toMatchObject({
      category: "CABINET",
      code: "MANUAL_CABINET_REVIEW",
      path: "cabinets.0",
      severity: "REQUIRED"
    });
  });
});
