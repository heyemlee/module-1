import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import { createDefaultCabinetRuns, createDefaultShowroomForm } from "./showroom-intake-data";

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
});
