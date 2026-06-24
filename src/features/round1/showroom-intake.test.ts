import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import { createElement } from "react";
import { createDefaultCabinetRuns, createDefaultShowroomForm } from "./showroom-intake-data";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOWROOM_STEPS, ShowroomIntakeApp } from "./showroom-intake-app";

describe("showroom intake defaults", () => {
  test("produce a complete Round 1 customer-confirmation preview model", () => {
    const form = createDefaultShowroomForm();
    const normalized = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    expect(normalized.normalized.salesEstimateOnly).toBe(true);
    expect(normalized.normalized.notForProduction).toBe(true);
    expect(normalized.readiness.canGenerateRound1Layout).toBe(true);
    expect(normalized.readiness.canEnterProduction).toBe(false);
    expect(estimate.cabinets.length).toBeGreaterThan(0);
    expect(estimate.salesEstimateOnly).toBe(true);
  });

  test("maps explicit L-shape direction and island status into cabinet runs", () => {
    const base = createDefaultShowroomForm();
    const leftRuns = createDefaultCabinetRuns({
      ...base,
      layoutPreference: "LEFT_L_SHAPE" as typeof base.layoutPreference
    });
    const rightRuns = createDefaultCabinetRuns({
      ...base,
      layoutPreference: "RIGHT_L_SHAPE" as typeof base.layoutPreference
    });
    const islandRuns = createDefaultCabinetRuns({
      ...base,
      layoutSensitiveCabinets: {
        ...base.layoutSensitiveCabinets,
        island: { status: "YES", requested: true, functions: [] }
      }
    });

    expect(leftRuns.some((run) => run.location === "LEFT_SIDE")).toBe(true);
    expect(leftRuns.some((run) => run.location === "RIGHT_SIDE")).toBe(false);
    expect(rightRuns.some((run) => run.location === "RIGHT_SIDE")).toBe(true);
    expect(rightRuns.some((run) => run.location === "LEFT_SIDE")).toBe(false);
    expect(islandRuns.some((run) => run.location === "ON_ISLAND")).toBe(true);
  });

  test("uses the approved adjust-position step order without first-phase MEP", () => {
    expect(SHOWROOM_STEPS).toEqual([
      "Room & Openings",
      "Layout & Appliances",
      "Adjust Positions",
      "Rendering Preferences"
    ]);
    expect(SHOWROOM_STEPS).not.toContain("MEP");
    expect(SHOWROOM_STEPS).not.toContain("Cabinets");
  });



  test("opens the combined room and openings step without later-stage objects", () => {
    const html = renderToStaticMarkup(createElement(ShowroomIntakeApp));

    // Step 0 is "Room & Openings", so the plan previews openings as they are
    // entered. Appliances and dishwasher panels belong to later stages and
    // must not render yet.
    expect(html).toContain('data-opening-symbol="window"');
    expect(html).toContain('data-opening-symbol="door"');
    expect(html).not.toContain('data-appliance-symbol="');
    expect(html).not.toContain('data-dishwasher-panel="true"');
  });
});
