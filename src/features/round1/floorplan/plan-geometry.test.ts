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
import {
  allowedDragWallsForLayout,
  buildFloorPlan,
  type PlanRect
} from "./plan-geometry";

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
    // Generic visual fillers wrap around fixed appliances (e.g. the fridge on
    // the L's left leg), so compare only the real estimated cabinets against
    // the estimate count; the renderer never fabricates extra real cabinets.
    const isReal = (c: { code: string }) =>
      !c.code.startsWith("ROUND1_GENERIC") && c.code !== "Visual Base";
    const realBase = plan.baseCabinets.filter(isReal);
    const realWall = plan.wallCabinets.filter(isReal);
    expect(realBase.length).toBeGreaterThan(0);
    expect(realBase.length).toBeLessThanOrEqual(baseCount);
    expect(realWall.length).toBeGreaterThan(0);
    expect(realWall.length).toBeLessThanOrEqual(wallCount);

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

  test("cabinet fill keeps sink and dishwasher integrated into base cabinets", () => {
    const { plan } = planFromForm(createDefaultShowroomForm());
    const plumbingAppliances = plan.appliances.filter((item) =>
      ["sink", "dishwasher"].includes(item.key)
    );

    for (const appliance of plumbingAppliances) {
      expect(
        plan.baseCabinets.some((cabinet) => intersects(cabinet, appliance)),
        `${appliance.key} sits inside a base cabinet footprint`
      ).toBe(true);
    }
  });

  test("does not render narrow clipped wall-cabinet fragments around the sink", () => {
    const form = createDefaultShowroomForm();
    const { plan } = planFromForm(form);
    const scale = plan.room.w / (form.room.length as number);
    const minimumStandaloneWallCabinet = 12 * scale;

    const narrowTopWallCabinets = plan.wallCabinets.filter(
      (cabinet) => cabinet.wall === "TOP" && cabinet.w < minimumStandaloneWallCabinet
    );

    expect(narrowTopWallCabinets).toHaveLength(0);
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

  test("never lets a range and a cooktop coexist (keeps the range, drops the cooktop)", () => {
    const base = createDefaultShowroomForm();
    const form: Round1FormInput = {
      ...base,
      layoutSensitiveCabinets: {
        ...base.layoutSensitiveCabinets,
        cookingAppliances: {
          ...base.layoutSensitiveCabinets.cookingAppliances,
          range: { status: "YES", relation: "BACK_SIDE" },
          cooktop: { status: "YES", relation: "BACK_SIDE" }
        }
      }
    };
    const { plan } = planFromForm(form);
    const keys = plan.appliances.map((item) => item.key);
    expect(keys).toContain("range");
    expect(keys).not.toContain("cooktop");
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
        island: { status: "YES" as const, requested: true, functions: [] }
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

  test("maps explicit left and right L-shapes to their matching wall legs", () => {
    expect(allowedDragWallsForLayout("LEFT_L_SHAPE")).toEqual(["TOP", "LEFT"]);
    expect(allowedDragWallsForLayout("RIGHT_L_SHAPE")).toEqual(["TOP", "RIGHT"]);
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

  test("auto-distributes no-preference cooking appliances across walls", () => {
    const base = formForLayout("L_SHAPE");
    const form: Round1FormInput = {
      ...base,
      layoutSensitiveCabinets: {
        ...base.layoutSensitiveCabinets,
        cookingAppliances: {
          range: { status: "YES", relation: "BACK_SIDE" },
          cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
          wallOven: { status: "YES", relation: "UNKNOWN" },
          microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
        }
      }
    };

    const { plan } = planFromForm(form);
    const autoWalls = plan.appliances
      .filter((a) => a.key === "wallOven" || a.key === "microwaveOvenCombo")
      .map((a) => a.wall);

    // L-shape only occupies TOP and LEFT; the wall oven and microwave must land
    // on a layout wall and must not all pile onto the (already busy) main run.
    expect(autoWalls.length).toBe(2);
    for (const wall of autoWalls) {
      expect(allowedDragWallsForLayout("L_SHAPE")).toContain(wall);
    }
    expect(autoWalls).toContain("LEFT");
  });

  test("renders one appliance symbol for stacked wall oven and microwave", () => {
    const base = formForLayout("L_SHAPE");
    const form: Round1FormInput = {
      ...base,
      layoutSensitiveCabinets: {
        ...base.layoutSensitiveCabinets,
        ovenMicrowave: {
          configuration: "WALL_OVEN_MICROWAVE_STACK",
          relation: "UNKNOWN"
        },
        cookingAppliances: {
          range: { status: "YES", relation: "BACK_SIDE" },
          cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
          wallOven: { status: "YES", relation: "UNKNOWN" },
          microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
        }
      }
    };

    const { plan } = planFromForm(form);
    const ovenKeys = plan.appliances
      .filter((item) => item.symbol === "oven")
      .map((item) => item.key);

    expect(ovenKeys).toEqual(["ovenMicrowaveStack"]);
  });

  test("renders separate symbols for separate wall oven and microwave", () => {
    const base = formForLayout("L_SHAPE");
    const form: Round1FormInput = {
      ...base,
      layoutSensitiveCabinets: {
        ...base.layoutSensitiveCabinets,
        ovenMicrowave: {
          configuration: "SEPARATE_WALL_OVEN_AND_MICROWAVE",
          relation: "UNKNOWN"
        },
        cookingAppliances: {
          range: { status: "YES", relation: "BACK_SIDE" },
          cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
          wallOven: { status: "YES", relation: "UNKNOWN" },
          microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
        }
      }
    };

    const { plan } = planFromForm(form);
    const ovenKeys = plan.appliances
      .filter((item) => item.symbol === "oven")
      .map((item) => item.key);

    expect(ovenKeys).toContain("wallOven");
    expect(ovenKeys).toContain("microwaveOvenCombo");
  });

  test("keeps an auto-placed cooktop on the main run beside the sink", () => {
    const base = formForLayout("L_SHAPE");
    const form: Round1FormInput = {
      ...base,
      layoutSensitiveCabinets: {
        ...base.layoutSensitiveCabinets,
        cookingAppliances: {
          range: { status: "NO", relation: "NOT_APPLICABLE" },
          cooktop: { status: "YES", relation: "UNKNOWN" },
          wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
          microwaveOvenCombo: { status: "NO", relation: "NOT_APPLICABLE" }
        }
      }
    };

    const { plan } = planFromForm(form);
    const cooktop = plan.appliances.find((a) => a.key === "cooktop");
    const sink = plan.appliances.find((a) => a.key === "sink");

    expect(cooktop?.wall).toBe("TOP");
    expect(sink?.wall).toBe("TOP");
  });

  test("still honors a dragged override for a no-wall-question appliance", () => {
    const base = formForLayout("L_SHAPE");
    const form: Round1FormInput = {
      ...base,
      layoutSensitiveCabinets: {
        ...base.layoutSensitiveCabinets,
        cookingAppliances: {
          range: { status: "YES", relation: "BACK_SIDE" },
          cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
          wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
          microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
        }
      }
    };

    const { plan } = planFromForm(form, {
      microwaveOvenCombo: { wall: "LEFT", position: 170 }
    });

    expect(
      plan.appliances.find((a) => a.key === "microwaveOvenCombo")?.wall
    ).toBe("LEFT");
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
