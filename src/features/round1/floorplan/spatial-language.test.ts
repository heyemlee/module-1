import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import { buildFloorPlan, type FloorPlan } from "./plan-geometry";
import {
  alongAxisValue,
  applianceNoun,
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
// In a galley the front (BOTTOM) wall is a real run, so the default
// front-side fridge legitimately sits behind the camera there.
const galleyPlan = planFor({
  ...createDefaultShowroomForm(),
  layoutPreference: "GALLEY"
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
  test("names a stacked wall oven and microwave tower", () => {
    expect(
      applianceNoun({
        key: "ovenMicrowaveStack",
        label: "Wall oven + microwave stack",
        symbol: "oven"
      })
    ).toBe("a stacked wall oven and microwave tower");
  });

  test("names a microwave oven combo distinctly from a wall oven", () => {
    expect(
      applianceNoun({
        key: "microwaveOvenCombo",
        label: "Microwave / oven combo",
        symbol: "oven"
      })
    ).toBe("a microwave / oven combo");
  });

  test("orders back-wall appliances sink -> dishwasher -> range and folds in the hood", () => {
    const desc = describeWall(defaultPlan, "TOP");
    expect(desc).not.toBeNull();
    const items = desc!.appliances;

    const sinkIndex = items.findIndex((item) => item.includes("sink"));
    const dishwasherIndex = items.findIndex((item) => item.includes("dishwasher"));
    const rangeIndex = items.findIndex((item) => item.includes("range"));

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

  test("describes a cabinet-only run with no appliances", () => {
    // The default L-shape now parks the fridge on the left leg, so use the
    // U-shape right wall, which is a pure cabinet run.
    const desc = describeWall(uShapePlan, "RIGHT");
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

  test("describes an open passage as a cased opening with no door leaf", () => {
    const base = createDefaultShowroomForm();
    const passagePlan = planFor({
      ...base,
      layoutPreference: "U_SHAPE",
      openings: {
        ...base.openings,
        doors: {
          status: "YES",
          items: [{ location: "LEFT_SIDE", kind: "OPEN_PASSAGE", width: null }]
        }
      }
    });

    const phrase = describeDoor(passagePlan);
    expect(phrase).toContain("open passage");
    expect(phrase).toContain("no door leaf");
    expect(phrase).toContain("the left wall");
    // It must not be described as a plain swinging door.
    expect(phrase).not.toContain("entry door");
  });
});

describe("describeBehindCameraAppliances", () => {
  test("notes a front-wall refrigerator is behind the viewpoint", () => {
    const phrase = describeBehindCameraAppliances(galleyPlan);
    expect(phrase).not.toBeNull();
    expect(phrase!).toContain("refrigerator");
    expect(phrase!).toContain("behind the viewpoint");
  });

  test("returns null when no appliance sits on the front wall", () => {
    // The default L-shape keeps every appliance within the L (back/left walls).
    expect(describeBehindCameraAppliances(defaultPlan)).toBeNull();
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
