import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "../showroom-intake-data";
import { buildFloorPlan, type FloorPlan } from "../floorplan/plan-geometry";
import { buildElevationScene } from "./elevation-scene";

function planFor(form: Round1FormInput = createDefaultShowroomForm()): FloorPlan {
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildFloorPlan(
    result.normalized,
    estimate.cabinets,
    result.confirmationItems.length + estimate.confirmationItems.length,
    {}
  );
}

describe("buildElevationScene", () => {
  test("builds deterministic rough wall scenes from the default L-shape plan", () => {
    const plan = planFor();
    const first = buildElevationScene(plan);
    const second = buildElevationScene(plan);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((wall) => wall.notForProduction)).toBe(true);
    expect(first.every((wall) => wall.dimensionConfidence === "ROUGH")).toBe(true);
  });

  test("maps internal walls to customer-facing elevation titles", () => {
    const scene = buildElevationScene(planFor());
    const titles = scene.map((wall) => wall.title);

    expect(titles).toContain("Back Wall");
    expect(titles).toContain("Left Wall");
    expect(titles).not.toContain("Right Wall");
  });

  test("omits walls with no Round 1 objects worth confirming", () => {
    const form: Round1FormInput = {
      ...createDefaultShowroomForm(),
      openings: {
        doors: { status: "NO", items: [] },
        windows: { status: "NO", items: [] }
      }
    };
    const scene = buildElevationScene(planFor(form));

    expect(scene.every((wall) => wall.items.length > 0)).toBe(true);
    expect(scene.map((wall) => wall.wall)).not.toContain("BOTTOM");
  });

  test("keeps appliances and openings on their source walls", () => {
    const scene = buildElevationScene(planFor());
    const back = scene.find((wall) => wall.wall === "TOP");
    const left = scene.find((wall) => wall.wall === "LEFT");
    const front = scene.find((wall) => wall.wall === "BOTTOM");

    expect(back?.items.some((item) => item.kind === "appliance" && item.symbol === "sink")).toBe(true);
    expect(back?.items.some((item) => item.kind === "appliance" && item.symbol === "range")).toBe(true);
    expect(back?.items.some((item) => item.kind === "appliance" && item.symbol === "hood")).toBe(true);
    expect(back?.items.some((item) => item.kind === "opening" && item.symbol === "window")).toBe(true);
    expect(left?.items.some((item) => item.kind === "appliance" && item.symbol === "fridge")).toBe(true);
    expect(front?.items.some((item) => item.symbol === "door")).not.toBe(true);
  });

  test("includes the front wall when a visible Round 1 object exists there", () => {
    const form = {
      ...createDefaultShowroomForm(),
      layoutPreference: "GALLEY" as const
    };
    const scene = buildElevationScene(planFor(form));
    const front = scene.find((wall) => wall.wall === "BOTTOM");

    expect(front?.title).toBe("Front Wall");
    expect(front?.items.some((item) => item.kind === "appliance" && item.symbol === "fridge")).toBe(true);
  });
});
