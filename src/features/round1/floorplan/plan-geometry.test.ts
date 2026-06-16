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
import { buildFloorPlan } from "./plan-geometry";

function planFromForm(form: Round1FormInput) {
  const { normalized } = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return {
    plan: buildFloorPlan(normalized, estimate.cabinets, 3),
    estimate
  };
}

describe("buildFloorPlan", () => {
  test("renders the room within the canvas and to scale", () => {
    const form = createDefaultShowroomForm();
    const { plan } = planFromForm(form);

    expect(plan.room.x).toBeGreaterThanOrEqual(0);
    expect(plan.room.y).toBeGreaterThanOrEqual(0);
    expect(plan.room.x + plan.room.w).toBeLessThanOrEqual(plan.canvas.w);
    expect(plan.room.y + plan.room.h).toBeLessThanOrEqual(plan.canvas.h);

    const scaleX = plan.room.w / (form.room.length as number);
    const scaleY = plan.room.h / (form.room.width as number);
    expect(scaleX).toBeCloseTo(scaleY, 5);
    expect(scaleX).toBeGreaterThan(0);
  });

  test("lays every cabinet from the list and a corner for the L-shape", () => {
    const form = createDefaultShowroomForm();
    const { plan, estimate } = planFromForm(form);

    const baseCount = estimate.cabinets.filter((c) => c.kind === "BASE").length;
    const wallCount = estimate.cabinets.filter((c) => c.kind === "WALL").length;
    expect(plan.baseCabinets.length).toBe(baseCount);
    expect(plan.wallCabinets.length).toBe(wallCount);

    // Default L-shape has a main (top) run and a left run -> one top-left corner.
    expect(plan.corners.length).toBe(1);
  });

  test("places the core appliances and W/G/E/V markers", () => {
    const { plan } = planFromForm(createDefaultShowroomForm());

    const keys = plan.appliances.map((a) => a.key);
    expect(keys).toContain("sink");
    expect(keys).toContain("range");
    expect(keys).toContain("fridge");
    expect(keys).toContain("dishwasher");

    const letters = plan.markers.map((m) => m.letter).sort();
    expect(letters).toEqual(["E", "G", "V", "W"]);
  });

  test("draws a window over the sink when the sink is under a window", () => {
    const { plan } = planFromForm(createDefaultShowroomForm());
    const sink = plan.appliances.find((a) => a.key === "sink");

    expect(plan.window).not.toBeNull();
    expect(sink).toBeDefined();
    const windowCenter = plan.window!.x + plan.window!.w / 2;
    const sinkCenter = sink!.x + sink!.w / 2;
    expect(Math.abs(windowCenter - sinkCenter)).toBeLessThan(2);
  });

  test("omits the window and door when the intake says they do not exist", () => {
    const form = createDefaultShowroomForm();
    const noOpenings: Round1FormInput = {
      ...form,
      openings: {
        doors: { status: "NO", items: [] },
        windows: { status: "NO", items: [] }
      },
      fixtures: {
        ...form.fixtures,
        sink: { ...form.fixtures.sink, relation: "ON_MAIN_RUN" }
      }
    };
    const { plan } = planFromForm(noOpenings);

    expect(plan.window).toBeNull();
    expect(plan.door).toBeNull();
  });
});
