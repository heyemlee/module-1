import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import { buildFloorPlan, type FloorPlan } from "./plan-geometry";
import {
  alongAxisValue,
  describeBehindCameraAppliances,
  describeCorners,
  describeDoor,
  describeWall,
  describeWindow,
  wallToCamera,
  wallWalkthroughSentence
} from "./spatial-language";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "../showroom-intake-data";

function planFor(form: Round1FormInput): FloorPlan {
  const { normalized } = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildFloorPlan(normalized, estimate.cabinets, 0, {});
}

const defaultPlan = planFor(createDefaultShowroomForm());
const sinkUnderWindowPlan = planFor({
  ...createDefaultShowroomForm(),
  openings: {
    ...createDefaultShowroomForm().openings,
    windows: {
      status: "YES",
      items: [{ relation: "BEHIND_SINK", width: null }]
    }
  },
  fixtures: {
    ...createDefaultShowroomForm().fixtures,
    sink: {
      ...createDefaultShowroomForm().fixtures.sink,
      relation: "UNDER_WINDOW"
    }
  }
});
const uShapePlan = planFor({
  ...createDefaultShowroomForm(),
  layoutPreference: "U_SHAPE"
});

describe("wallToCamera", () => {
  test("maps internal walls to the fixed camera convention", () => {
    expect(wallToCamera("TOP")).toBe("back");
    expect(wallToCamera("BOTTOM")).toBe("front");
    expect(wallToCamera("LEFT")).toBe("left");
    expect(wallToCamera("RIGHT")).toBe("right");
  });
});

describe("alongAxisValue", () => {
  test("orders the back wall left to right by center x", () => {
    const left = alongAxisValue("TOP", { x: 100, y: 0, w: 10, h: 10 });
    const right = alongAxisValue("TOP", { x: 300, y: 0, w: 10, h: 10 });
    expect(left).toBeLessThan(right);
  });

  test("orders side walls nearest-the-camera (largest y) first", () => {
    const near = alongAxisValue("LEFT", { x: 0, y: 300, w: 10, h: 10 });
    const far = alongAxisValue("LEFT", { x: 0, y: 100, w: 10, h: 10 });
    expect(near).toBeLessThan(far);
  });
});

describe("describeWall", () => {
  test("orders back-wall appliances sink -> dishwasher -> range and folds in the hood", () => {
    const desc = describeWall(defaultPlan, "TOP");
    expect(desc).not.toBeNull();
    const items = desc!.appliances;

    const sinkIndex = items.findIndex((item) => item.includes("sink"));
    const dishwasherIndex = items.findIndex((item) => item.includes("dishwasher"));
    const rangeIndex = items.findIndex((item) => item.includes("range/cooktop"));

    expect(sinkIndex).toBeGreaterThanOrEqual(0);
    expect(dishwasherIndex).toBeGreaterThanOrEqual(0);
    expect(rangeIndex).toBeGreaterThanOrEqual(0);
    expect(sinkIndex).toBeLessThan(dishwasherIndex);
    expect(dishwasherIndex).toBeLessThan(rangeIndex);

    // The hood is folded into the range item, never a standalone noun.
    expect(items[rangeIndex]).toContain("hood above it");
    expect(items.some((item) => item === "a range hood")).toBe(false);
    expect(desc!.hasCabinetRun).toBe(true);
  });

  test("describes the left wall as a cabinet-only run", () => {
    const desc = describeWall(defaultPlan, "LEFT");
    expect(desc).not.toBeNull();
    expect(desc!.appliances).toHaveLength(0);
    expect(desc!.hasCabinetRun).toBe(true);
  });
});

describe("describeCorners", () => {
  test("default L-shape has a single back-left corner", () => {
    const corners = describeCorners(defaultPlan);
    expect(corners).toHaveLength(1);
    expect(corners[0]).toContain("back-left");
  });

  test("U-shape has back-left and back-right corners", () => {
    const corners = describeCorners(uShapePlan);
    expect(corners).toHaveLength(2);
    expect(corners.join(" ")).toContain("back-left");
    expect(corners.join(" ")).toContain("back-right");
  });
});

describe("describeWindow", () => {
  test("places the default window on its wall without forcing sink alignment", () => {
    const phrase = describeWindow(defaultPlan);
    expect(phrase).not.toBeNull();
    expect(phrase!).toContain("the back wall");
    expect(phrase!).not.toContain("above the sink");
  });

  test("keeps legacy sink-under-window wording when explicitly provided", () => {
    const phrase = describeWindow(sinkUnderWindowPlan);
    expect(phrase).not.toBeNull();
    expect(phrase!).toContain("above the sink");
  });
});

describe("describeDoor", () => {
  test("keeps the front-wall door behind the camera with a negative constraint", () => {
    const phrase = describeDoor(defaultPlan);
    expect(phrase).toContain("the front wall");
    expect(phrase).toContain("must NOT");
  });
});

describe("describeBehindCameraAppliances", () => {
  test("notes the front-wall refrigerator is behind the viewpoint", () => {
    const phrase = describeBehindCameraAppliances(defaultPlan);
    expect(phrase).not.toBeNull();
    expect(phrase!).toContain("refrigerator");
    expect(phrase!).toContain("behind the viewpoint");
  });
});

describe("wallWalkthroughSentence", () => {
  test("opens the back wall left to right", () => {
    const sentence = wallWalkthroughSentence(defaultPlan, "TOP");
    expect(sentence).not.toBeNull();
    expect(sentence!.startsWith("On the back wall, from left to right:")).toBe(true);
    expect(sentence!).toContain("a sink");
  });

  test("orders side walls from nearest the camera", () => {
    const sentence = wallWalkthroughSentence(defaultPlan, "LEFT");
    expect(sentence).not.toBeNull();
    expect(sentence!).toContain("from nearest the camera to the far end");
    expect(sentence!).toContain("continuous run of base and wall cabinets");
  });
});
