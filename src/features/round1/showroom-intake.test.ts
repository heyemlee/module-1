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

  test("uses the approved adjust-position step order without first-phase MEP", () => {
    expect(SHOWROOM_STEPS).toEqual([
      "Room",
      "Openings",
      "Layout",
      "Appliances",
      "Adjust Positions"
    ]);
    expect(SHOWROOM_STEPS).not.toContain("MEP");
    expect(SHOWROOM_STEPS).not.toContain("Cabinets");
  });

  test("does not fill cabinets before door window and appliance positions are confirmed", () => {
    const html = renderToStaticMarkup(createElement(ShowroomIntakeApp));

    expect(html).toContain("Confirm dragged door, window, and appliance positions before cabinet fill.");
    expect(html).not.toContain("Approximate only. The program fills standard cabinets");
  });

  test("opens with an empty room shell before the adjust positions step", () => {
    const html = renderToStaticMarkup(createElement(ShowroomIntakeApp));

    expect(html).not.toContain('data-appliance-symbol="');
    expect(html).not.toContain('data-opening-symbol="');
    expect(html).not.toContain('data-dishwasher-panel="true"');
  });
});
