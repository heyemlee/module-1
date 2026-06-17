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
import { buildFloorPlan, type PlanRect } from "./plan-geometry";

function planFromForm(form: Round1FormInput, overrides = {}) {
  const { normalized } = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return {
    plan: buildFloorPlan(normalized, estimate.cabinets, 3, overrides),
    estimate
  };
}

function formForLayout(layoutPreference: Round1FormInput["layoutPreference"]): Round1FormInput {
  const form = createDefaultShowroomForm();
  return {
    ...form,
    layoutPreference,
    openings: {
      doors: { status: "NO", items: [] },
      windows: { status: "NO", items: [] }
    },
    fixtures: {
      ...form.fixtures,
      sink: { ...form.fixtures.sink, relation: "ON_MAIN_RUN" }
    },
    layoutSensitiveCabinets: {
      ...form.layoutSensitiveCabinets,
      island: {
        ...form.layoutSensitiveCabinets.island,
        requested: /ISLAND/.test(layoutPreference)
      }
    }
  };
}

function formWithSinkUnderWindow(): Round1FormInput {
  const form = createDefaultShowroomForm();
  return {
    ...form,
    openings: {
      ...form.openings,
      windows: {
        status: "YES",
        items: [{ relation: "BEHIND_SINK", width: null }]
      }
    },
    fixtures: {
      ...form.fixtures,
      sink: { ...form.fixtures.sink, relation: "UNDER_WINDOW" }
    }
  };
}

function intersects(a: PlanRect, b: PlanRect) {
  return (
    a.x < b.x + b.w - 0.1 &&
    a.x + a.w > b.x + 0.1 &&
    a.y < b.y + b.h - 0.1 &&
    a.y + a.h > b.y + 0.1
  );
}

function applianceRect(plan: ReturnType<typeof buildFloorPlan>, key: string) {
  const appliance = plan.appliances.find((item) => item.key === key);
  expect(appliance, `${key} exists`).toBeDefined();
  return {
    x: appliance!.x,
    y: appliance!.y,
    w: appliance!.w,
    h: appliance!.h,
    wall: appliance!.wall
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

  test("lays cabinet runs and a corner for the L-shape without forcing impossible cabinets", () => {
    const form = createDefaultShowroomForm();
    const { plan, estimate } = planFromForm(form);

    const baseCount = estimate.cabinets.filter((c) => c.kind === "BASE").length;
    const wallCount = estimate.cabinets.filter((c) => c.kind === "WALL").length;
    expect(plan.baseCabinets.length).toBeGreaterThan(0);
    expect(plan.baseCabinets.length).toBeLessThanOrEqual(baseCount);
    expect(plan.wallCabinets.length).toBeGreaterThan(0);
    expect(plan.wallCabinets.length).toBeLessThanOrEqual(wallCount);

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

  test("cabinet fill does not move or resize fixed appliances", () => {
    const form = createDefaultShowroomForm();
    const { normalized } = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
    const beforeFill = buildFloorPlan(normalized, [], 3, {});
    const afterFill = buildFloorPlan(normalized, estimate.cabinets, 3, {});

    for (const key of ["sink", "dishwasher", "range", "fridge"]) {
      expect(applianceRect(afterFill, key)).toEqual(applianceRect(beforeFill, key));
    }
  });

  test("cabinet fill keeps sink and dishwasher footprints clear", () => {
    const { plan } = planFromForm(createDefaultShowroomForm());
    const plumbingAppliances = plan.appliances.filter((item) =>
      ["sink", "dishwasher"].includes(item.key)
    );

    for (const appliance of plumbingAppliances) {
      for (const cabinet of plan.baseCabinets) {
        expect(
          intersects(cabinet, appliance),
          `${cabinet.code} overlaps ${appliance.key}`
        ).toBe(false);
      }
    }
  });

  test("uses rough cooking appliance presence fields instead of always drawing range", () => {
    const form: Round1FormInput = {
      ...createDefaultShowroomForm(),
      fixtures: {
        ...createDefaultShowroomForm().fixtures,
        range: {
          size: null,
          fuel: "UNKNOWN",
          fixedLocation: "UNKNOWN",
          relation: "BACK_SIDE"
        }
      },
      layoutSensitiveCabinets: {
        ...createDefaultShowroomForm().layoutSensitiveCabinets,
        cookingAppliances: {
          range: { status: "NO", relation: "NOT_APPLICABLE" },
          cooktop: { status: "YES", relation: "BACK_SIDE" },
          wallOven: { status: "YES", relation: "LEFT_SIDE" },
          microwaveOvenCombo: { status: "YES", relation: "RIGHT_SIDE" }
        }
      }
    };

    const { plan } = planFromForm(form);
    const keys = plan.appliances.map((item) => item.key);

    expect(keys).not.toContain("range");
    expect(keys).toContain("cooktop");
    expect(keys).toContain("wallOven");
    expect(keys).toContain("microwaveOvenCombo");
  });

  test("draws a window over the sink when the sink is under a window", () => {
    const { plan } = planFromForm(formWithSinkUnderWindow());
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

  test("uses dragged fixed-object overrides as hard anchors without final overlap", () => {
    const form: Round1FormInput = {
      ...createDefaultShowroomForm(),
      layoutPreference: "ONE_WALL",
      openings: {
        doors: { status: "NO", items: [] },
        windows: { status: "NO", items: [] }
      },
      fixtures: {
        ...createDefaultShowroomForm().fixtures,
        sink: { size: 33, type: "UNKNOWN", relation: "ON_MAIN_RUN" },
        range: {
          size: 30,
          fuel: "GAS",
          fixedLocation: "UNKNOWN",
          relation: "ON_MAIN_RUN"
        },
        fridge: { size: 36, type: "UNKNOWN", relation: "ON_MAIN_RUN" },
        dishwasher: { status: "YES", size: 24, relation: "NEAR_SINK" }
      }
    };
    const initial = planFromForm(form).plan;
    const sink = initial.appliances.find((item) => item.key === "sink")!;

    const { plan } = planFromForm(form, {
      fridge: { wall: "TOP", position: sink.x },
      range: { wall: "TOP", position: sink.x },
      dishwasher: { wall: "TOP", position: sink.x }
    });

    const draggable = plan.appliances.filter((item) =>
      ["sink", "range", "fridge", "dishwasher"].includes(item.key)
    );
    for (const item of draggable) {
      for (const other of draggable) {
        if (item.key >= other.key) continue;
        expect(intersects(item, other), `${item.key} overlaps ${other.key}`).toBe(false);
      }
    }

    const fridge = plan.appliances.find((item) => item.key === "fridge")!;
    expect(
      plan.baseCabinets.some((cabinet) => intersects(cabinet, fridge))
    ).toBe(false);
  });

  test("keeps appliance and opening front clearance zones free of cabinetry and islands", () => {
    const form = {
      ...createDefaultShowroomForm(),
      layoutPreference: "U_SHAPE_ISLAND" as const,
      layoutSensitiveCabinets: {
        ...createDefaultShowroomForm().layoutSensitiveCabinets,
        island: { requested: true, functions: [] }
      }
    };

    const { plan } = planFromForm(form);
    expect(plan.clearanceZones.length).toBeGreaterThan(0);

    const blockers = [
      ...plan.baseCabinets,
      ...plan.corners,
      ...(plan.island ? [plan.island] : [])
    ];

    for (const clearance of plan.clearanceZones) {
      for (const blocker of blockers) {
        expect(
          intersects(clearance, blocker),
          `${clearance.ownerKey} clearance blocked`
        ).toBe(false);
      }
    }
  });

  test("coarsely fills visible cabinet gaps around fixed appliances for Round 1", () => {
    const form: Round1FormInput = {
      ...createDefaultShowroomForm(),
      layoutPreference: "U_SHAPE",
      fixtures: {
        ...createDefaultShowroomForm().fixtures,
        fridge: { size: 36, type: "UNKNOWN", relation: "RIGHT_SIDE" }
      }
    };

    const { plan } = planFromForm(form);
    const genericBase = plan.baseCabinets.filter((cabinet) =>
      cabinet.code.startsWith("ROUND1_GENERIC_BASE")
    );
    const genericWall = plan.wallCabinets.filter((cabinet) =>
      cabinet.code.startsWith("ROUND1_GENERIC_WALL")
    );

    expect(genericBase.length).toBeGreaterThan(0);
    expect(genericWall.length).toBeGreaterThan(0);
  });

  test("maps galley layouts to top and bottom base cabinet runs", () => {
    const { plan } = planFromForm(formForLayout("GALLEY"));

    expect(new Set(plan.baseCabinets.map((cabinet) => cabinet.wall))).toEqual(
      new Set(["TOP", "BOTTOM"])
    );
  });

  test("maps U-shape layouts to three wall runs and two base corners", () => {
    const { plan } = planFromForm(formForLayout("U_SHAPE"));

    expect(new Set(plan.baseCabinets.map((cabinet) => cabinet.wall))).toEqual(
      new Set(["TOP", "LEFT", "RIGHT"])
    );
    expect(plan.corners).toHaveLength(2);
  });

  test("island layouts produce an island and island cabinet estimate entries", () => {
    const { plan, estimate } = planFromForm(formForLayout("L_SHAPE_ISLAND"));

    expect(plan.island).not.toBeNull();
    expect(
      estimate.cabinets.some((cabinet) => cabinet.location === "ON_ISLAND")
    ).toBe(true);
  });

  test("uses wall-aware overrides for draggable appliances on layout-allowed walls", () => {
    const lShape = planFromForm(formForLayout("L_SHAPE"), {
      range: { wall: "LEFT", position: 170 }
    }).plan;
    const uShape = planFromForm(formForLayout("U_SHAPE"), {
      fridge: { wall: "RIGHT", position: 180 }
    }).plan;

    expect(lShape.appliances.find((item) => item.key === "range")?.wall).toBe("LEFT");
    expect(uShape.appliances.find((item) => item.key === "fridge")?.wall).toBe("RIGHT");
  });

  test("ignores wall-aware overrides outside the current layout wall set", () => {
    const { plan } = planFromForm(formForLayout("L_SHAPE"), {
      fridge: { wall: "RIGHT", position: 180 }
    });

    expect(plan.appliances.find((item) => item.key === "fridge")?.wall).not.toBe(
      "RIGHT"
    );
  });

  test("snaps sink and window centers together when their overlap is near aligned", () => {
    const form = formWithSinkUnderWindow();
    const initial = planFromForm(form).plan;
    const window = initial.window!;

    const { plan } = planFromForm(form, {
      window: { wall: "TOP", position: window.x },
      sink: { wall: "TOP", position: window.x + 4 }
    });

    const sink = plan.appliances.find((item) => item.key === "sink")!;
    const windowCenter = plan.window!.x + plan.window!.w / 2;
    const sinkCenter = sink.x + sink.w / 2;
    expect(Math.abs(windowCenter - sinkCenter)).toBeLessThan(2);
  });
});
