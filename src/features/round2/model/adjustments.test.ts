import { describe, expect, test } from "vitest";
import {
  sinkCenteringOffsetSixteenths,
  type Round2Model,
  type Round2Wall
} from "./round2-model";
import {
  heightProfileTotal,
  nudgeGroup,
  recenterSink,
  removeFiller,
  restoreFiller,
  setFillerPlacement,
  setHeightProfile,
  setSegmentFront,
  setSegmentKind,
  standardWidthOptionsSixteenths,
  stepCabinetWidth,
  updateModelDecisions,
  wallTierTotal
} from "./adjustments";
import { CABINET_STANDARDS } from "./cabinet-standards";

describe("Round 2 constrained adjustments", () => {
  test("offers exactly the widths from the shared cabinet standards", () => {
    expect(standardWidthOptionsSixteenths()).toEqual(
      CABINET_STANDARDS.base.widthsSixteenths
    );
  });

  test("steps cabinet width and absorbs the delta into same-tier filler", () => {
    const model = modelWithWall(wallWithSegments());
    const adjusted = stepCabinetWidth(model, "a-base-cabinet", 33 * 16);
    const wall = adjusted.walls[0];

    expect(segmentWidth(wall, "a-base-cabinet")).toBe(33 * 16);
    expect(segmentWidth(wall, "a-base-filler")).toBe(3 * 16);
    expect(wallTierTotal(wall, "base")).toBe(wall.lengthSixteenths);
    expect(adjusted.decisionItems).toHaveLength(0);
  });

  test("keeps the run closed and emits a decision when filler goes below minimum", () => {
    const model = modelWithWall(wallWithSegments());
    const adjusted = stepCabinetWidth(model, "a-base-cabinet", 36 * 16);
    const wall = adjusted.walls[0];

    expect(segmentWidth(wall, "a-base-filler")).toBeUndefined();
    expect(wallTierTotal(wall, "base")).toBe(wall.lengthSixteenths);
    expect(adjusted.decisionItems).toHaveLength(0);

    const overdrawn = stepCabinetWidth(adjusted, "a-base-cabinet-2", 36 * 16);
    expect(overdrawn.decisionItems[0].title).toContain("overdrawn");
    expect(wallTierTotal(overdrawn.walls[0], "base")).toBe(
      overdrawn.walls[0].lengthSixteenths
    );
  });

  test("nudges a selected group by transferring 1/16 between fillers", () => {
    const adjusted = nudgeGroup(
      modelWithWall(wallWithSegments()),
      "a-base-cabinet-2",
      "right"
    );
    const wall = adjusted.walls[0];

    expect(segmentWidth(wall, "a-base-left-filler")).toBe(1);
    expect(segmentWidth(wall, "a-base-filler")).toBe(6 * 16 - 1);
    expect(wallTierTotal(wall, "base")).toBe(wall.lengthSixteenths);
  });

  test("rejects nudging a filler: remainder space repositions via placement", () => {
    const model = modelWithWall(wallWithSegments());
    expect(nudgeGroup(model, "a-base-filler", "left")).toBe(model);
  });

  test("placement start merges every zone filler into one at the zone start", () => {
    const adjusted = setFillerPlacement(
      modelWithWall(wallWithSegments()),
      "a-base-filler",
      "start"
    );
    const fillers = adjusted.walls[0].segments.filter(
      (segment) => segment.kind === "filler"
    );
    const baseIds = adjusted.walls[0].segments
      .filter((segment) => segment.tier === "base")
      .map((segment) => segment.id);

    expect(fillers).toHaveLength(1);
    expect(fillers[0].widthSixteenths).toBe(6 * 16);
    expect(baseIds[0]).toBe("a-base-filler");
    expect(wallTierTotal(adjusted.walls[0], "base")).toBe(
      adjusted.walls[0].lengthSixteenths
    );
  });

  test("placement end merges the remainder at the zone end", () => {
    const adjusted = setFillerPlacement(
      modelWithWall(wallWithSegments()),
      "a-base-filler",
      "end"
    );
    const baseIds = adjusted.walls[0].segments
      .filter((segment) => segment.tier === "base")
      .map((segment) => segment.id);

    expect(baseIds.at(-1)).toBe("a-base-filler");
    expect(
      adjusted.walls[0].segments.filter(
        (segment) => segment.kind === "filler"
      )
    ).toHaveLength(1);
  });

  test("placement split halves the remainder across both zone ends", () => {
    const adjusted = setFillerPlacement(
      modelWithWall(wallWithSegments()),
      "a-base-filler",
      "split"
    );
    const base = adjusted.walls[0].segments.filter(
      (segment) => segment.tier === "base"
    );

    expect(base[0].kind).toBe("filler");
    expect(base.at(-1)?.kind).toBe("filler");
    expect(base[0].widthSixteenths).toBe(3 * 16);
    expect(base.at(-1)?.widthSixteenths).toBe(3 * 16);
    expect(wallTierTotal(adjusted.walls[0], "base")).toBe(
      adjusted.walls[0].lengthSixteenths
    );
  });

  test("removes a filler into an intentional gap without changing its geometry", () => {
    const model = modelWithWall(wallWithSegments());
    const before = model.walls[0].segments
      .filter((segment) => segment.widthSixteenths > 0)
      .map((segment) => segment.id);
    const adjusted = removeFiller(model, "a-base-filler");
    const segment = adjusted.walls[0].segments.find(
      (item) => item.id === "a-base-filler"
    );

    expect(
      adjusted.walls[0].segments
        .filter((item) => item.widthSixteenths > 0)
        .map((item) => item.id)
    ).toEqual(before);
    expect(segment).toMatchObject({
      kind: "gap",
      intentionalGap: true,
      widthSixteenths: 6 * 16,
      label: "Open gap"
    });
    expect(wallTierTotal(adjusted.walls[0], "base")).toBe(
      adjusted.walls[0].lengthSixteenths
    );
  });

  test("restores only an intentionally removed filler", () => {
    const model = modelWithWall(wallWithSegments());
    const removed = removeFiller(model, "a-base-filler");
    const restored = restoreFiller(removed, "a-base-filler");
    const segment = restored.walls[0].segments.find(
      (item) => item.id === "a-base-filler"
    );

    expect(segment).toMatchObject({
      kind: "filler",
      widthSixteenths: 6 * 16,
      label: "F6"
    });
    expect(segment?.intentionalGap).toBeUndefined();
    expect(restoreFiller(model, "a-base-cabinet")).toBe(model);
  });

  test("does not convert ordinary base cabinets into sink cabinets", () => {
    const model = modelWithWall(wallWithSegments());

    const adjusted = setSegmentKind(model, "a-base-cabinet", "sink");

    expect(adjusted).toBe(model);
  });

  test("does not convert layout-sourced appliance reservations into cabinet kinds", () => {
    const wall = wallWithSegments();
    wall.segments[1] = {
      ...wall.segments[1],
      id: "a-dishwasher",
      kind: "appliance",
      label: "DW24",
      cabinetKind: undefined,
      sourceFixedPointId: "top-appliance-dishwasher"
    };
    const model = modelWithWall(wall);

    const adjusted = setSegmentKind(model, "a-dishwasher", "base");

    expect(adjusted).toBe(model);
  });

  test.each([
    ["dishwasher", "DW24"],
    ["range", "RNG30"],
    ["sink", "SB30"]
  ])("does not resize the immutable %s reservation", (_symbol, label) => {
    const wall = wallWithSegments();
    wall.segments[1] = {
      ...wall.segments[1],
      id: `a-${label.toLowerCase()}`,
      kind: "appliance",
      label,
      cabinetKind: label === "SB30" ? "sink" : undefined,
      sourceFixedPointId: `top-appliance-${label.toLowerCase()}`
    };
    const model = modelWithWall(wall);
    const applianceId = `a-${label.toLowerCase()}`;

    expect(
      stepCabinetWidth(
        model,
        applianceId,
        wall.segments[1].widthSixteenths + 16
      )
    ).toBe(model);
  });

  test.each([
    ["dishwasher", "DW24", 24 * 16],
    ["range", "RNG30", 30 * 16],
    ["sink", "SB36", 36 * 16]
  ])(
    "keeps the %s reservation fixed when its neighboring cabinet changes",
    (_symbol, label, applianceWidth) => {
      const model = modelWithWall(
        wallWithCabinetBesideAppliance(label, applianceWidth)
      );
      const beforeWall = model.walls[0];
      const applianceId = `a-${label.toLowerCase()}`;
      const applianceBefore = findSeg(beforeWall, applianceId)!;
      const applianceStart = segmentStart(beforeWall, applianceId);

      const adjusted = stepCabinetWidth(model, "a-left-cabinet", 29 * 16);
      const wall = adjusted.walls[0];
      const appliance = findSeg(wall, applianceId)!;

      expect(appliance.widthSixteenths).toBe(applianceBefore.widthSixteenths);
      expect(segmentStart(wall, applianceId)).toBe(applianceStart);
      expect(wallTierTotal(wall, "base")).toBe(wall.lengthSixteenths);
    }
  );

  test("accepts a custom width from the width-chain input", () => {
    const model = modelWithWall(wallWithSegments());
    const adjusted = stepCabinetWidth(model, "a-base-cabinet", 31 * 16 + 8);
    const wall = adjusted.walls[0];

    expect(segmentWidth(wall, "a-base-cabinet")).toBe(31 * 16 + 8);
    expect(wallTierTotal(wall, "base")).toBe(wall.lengthSixteenths);
  });

  test("rejects a custom cabinet width below the nine-inch minimum", () => {
    const model = modelWithWall(wallWithSegments());

    expect(stepCabinetWidth(model, "a-base-cabinet", 8 * 16)).toBe(model);
  });

  test("rejects zero or fractional custom widths", () => {
    const model = modelWithWall(wallWithSegments());
    expect(stepCabinetWidth(model, "a-base-cabinet", 0)).toBe(model);
    expect(stepCabinetWidth(model, "a-base-cabinet", 30.5)).toBe(model);
  });

  test("does not resize or nudge an immutable corner cabinet", () => {
    const wall = wallWithSegments();
    wall.segments[1] = {
      ...wall.segments[1],
      cabinetKind: "corner",
      label: "LS30",
      sourceCornerId: "TL"
    };
    const model = modelWithWall(wall);

    expect(stepCabinetWidth(model, "a-base-cabinet", 33 * 16)).toBe(model);
    expect(nudgeGroup(model, "a-base-cabinet", "right")).toBe(model);
  });

  test("does not nudge an appliance reservation", () => {
    const wall = wallWithSegments();
    wall.segments[1] = {
      ...wall.segments[1],
      id: "a-range",
      kind: "appliance",
      label: "RNG30",
      sourceFixedPointId: "top-appliance-range"
    };
    const model = modelWithWall(wall);

    expect(nudgeGroup(model, "a-range", "right")).toBe(model);
  });

  test("stores a front exception without moving any widths", () => {
    const model = modelWithWall(wallWithSegments());
    const adjusted = setSegmentFront(model, "a-base-cabinet", {
      doorCount: 1,
      accessories: ["trashPullout"]
    });
    const segment = adjusted.walls[0].segments.find(
      (item) => item.id === "a-base-cabinet"
    );

    expect(segment?.front).toEqual({
      doorCount: 1,
      accessories: ["trashPullout"]
    });
    expect(segment?.widthSixteenths).toBe(30 * 16);
    expect(wallTierTotal(adjusted.walls[0], "base")).toBe(
      adjusted.walls[0].lengthSixteenths
    );
  });

  test("keeps corner-only accessories off ordinary cabinet fronts", () => {
    const model = modelWithWall(wallWithSegments());
    const adjusted = setSegmentFront(model, "a-base-cabinet", {
      accessories: ["trashPullout", "lazySusan", "magicCorner"]
    });
    const segment = adjusted.walls[0].segments.find(
      (item) => item.id === "a-base-cabinet"
    );

    expect(segment?.front?.accessories).toEqual(["trashPullout"]);
  });

  test("allows corner hardware accessories on corner cabinet fronts", () => {
    const wall = wallWithSegments();
    wall.segments[1] = {
      ...wall.segments[1],
      cabinetKind: "corner",
      label: "BB45"
    };

    const adjusted = setSegmentFront(modelWithWall(wall), "a-base-cabinet", {
      accessories: ["magicCorner"]
    });
    const segment = adjusted.walls[0].segments.find(
      (item) => item.id === "a-base-cabinet"
    );

    expect(segment?.front?.accessories).toEqual(["magicCorner"]);
  });

  test("merges later front exceptions onto earlier ones", () => {
    const model = setSegmentFront(
      modelWithWall(wallWithSegments()),
      "a-base-cabinet",
      { doorCount: 1 }
    );
    const adjusted = setSegmentFront(model, "a-base-cabinet", {
      hardware: "fingerPull"
    });
    const segment = adjusted.walls[0].segments.find(
      (item) => item.id === "a-base-cabinet"
    );

    expect(segment?.front).toEqual({ doorCount: 1, hardware: "fingerPull" });
  });

  test("flags the height chain when it exceeds the measured ceiling", () => {
    const model = {
      ...modelWithWall(wallWithSegments()),
      heightProfile: {
        counterSixteenths: 36 * 16,
        backsplashSixteenths: 18 * 16,
        upperHeightSixteenths: 36 * 16,
        mouldingSixteenths: 3 * 16
      }
    };

    const stepped = setHeightProfile(model, { upperHeightSixteenths: 42 * 16 });

    expect(heightProfileTotal(stepped.heightProfile!)).toBe(99 * 16);
    expect(stepped.decisionItems).toContainEqual(
      expect.objectContaining({
        id: "decision-height-chain-overflow",
        severity: "blocking"
      })
    );

    const restored = setHeightProfile(stepped, {
      upperHeightSixteenths: 36 * 16
    });
    expect(
      restored.decisionItems.filter((item) =>
        item.id.startsWith("decision-height-chain")
      )
    ).toHaveLength(0);
  });

  test("keeps an anchored sink centered when a neighboring cabinet is resized", () => {
    const model = modelWithWall(wallWithAnchoredSink());
    const sinkBefore = sinkCenteringOffsetSixteenths(
      model.walls[0],
      findSeg(model.walls[0], "a-sink")!
    );
    expect(sinkBefore).toBe(0);

    const adjusted = stepCabinetWidth(model, "a-left-cabinet", 33 * 16);
    const wall = adjusted.walls[0];

    // The +3″ delta is absorbed by the filler on the sink's own side, so the
    // sink does not slide off the window center.
    expect(segmentWidth(wall, "a-left-cabinet")).toBe(33 * 16);
    expect(segmentWidth(wall, "a-left-filler")).toBe(12 * 16);
    expect(segmentWidth(wall, "a-right-filler")).toBe(15 * 16);
    expect(
      sinkCenteringOffsetSixteenths(wall, findSeg(wall, "a-sink")!)
    ).toBe(0);
    expect(wallTierTotal(wall, "base")).toBe(wall.lengthSixteenths);
    expect(
      adjusted.decisionItems.filter((item) => item.id.includes("off-center"))
    ).toHaveLength(0);
  });

  test("flags an anchored sink that has drifted off the window center", () => {
    const wall = wallWithAnchoredSink();
    // Push remainder onto the left so the sink starts 5″ right of center.
    wall.segments = wall.segments.map((segment) => {
      if (segment.id === "a-left-filler") {
        return { ...segment, widthSixteenths: 20 * 16 };
      }
      if (segment.id === "a-right-filler") {
        return { ...segment, widthSixteenths: 10 * 16 };
      }
      return segment;
    });

    const decided = updateModelDecisions(modelWithWall(wall));
    const offCenter = decided.decisionItems.find((item) =>
      item.id.includes("off-center")
    );

    expect(offCenter?.severity).toBe("warning");
    expect(offCenter?.body).toContain("window center");
  });

  test("re-centers a drifted anchored sink and keeps its anchor", () => {
    const wall = wallWithAnchoredSink();
    wall.segments = wall.segments.map((segment) => {
      if (segment.id === "a-left-filler") {
        return { ...segment, widthSixteenths: 20 * 16 };
      }
      if (segment.id === "a-right-filler") {
        return { ...segment, widthSixteenths: 10 * 16 };
      }
      return segment;
    });
    const model = modelWithWall(wall);
    expect(
      sinkCenteringOffsetSixteenths(model.walls[0], findSeg(model.walls[0], "a-sink")!)
    ).not.toBe(0);

    const recentered = recenterSink(model, "a-sink");
    const centeredWall = recentered.walls[0];
    const sink = findSeg(centeredWall, "a-sink")!;

    expect(sink.anchored).toBe(true);
    expect(sinkCenteringOffsetSixteenths(centeredWall, sink)).toBe(0);
    expect(wallTierTotal(centeredWall, "base")).toBe(
      centeredWall.lengthSixteenths
    );
    expect(
      recentered.decisionItems.filter((item) => item.id.includes("off-center"))
    ).toHaveLength(0);
  });

  test("rejects nudging an anchored sink; re-centering is the only sink move", () => {
    const model = modelWithWall(wallWithAnchoredSink());
    const nudged = nudgeGroup(model, "a-sink", "left");
    const sink = findSeg(nudged.walls[0], "a-sink")!;

    expect(nudged).toBe(model);
    expect(sink.anchored).toBe(true);
  });

  test("describes the configured three-inch filler minimum", () => {
    const wall = wallWithSegments();
    wall.segments = wall.segments.map((segment) =>
      segment.id === "a-base-filler"
        ? { ...segment, widthSixteenths: 8 }
        : segment
    );
    wall.lengthSixteenths = wallTierTotal(wall, "base");

    const updated = updateModelDecisions(modelWithWall(wall));

    expect(updated.decisionItems[0].body).toContain("3");
  });
});

function wallWithSegments(): Round2Wall {
  return {
    id: "A",
    label: "A",
    sourceWall: "TOP",
    lengthSixteenths: 66 * 16,
    fixedPoints: [],
    notes: [],
    segments: [
      {
        id: "a-base-left-filler",
        wallId: "A",
        tier: "base",
        kind: "filler",
        widthSixteenths: 0,
        label: "F0"
      },
      {
        id: "a-base-cabinet",
        wallId: "A",
        tier: "base",
        kind: "cabinet",
        widthSixteenths: 30 * 16,
        label: "B30",
        cabinetKind: "base",
        standardWidthSixteenths: 30 * 16
      },
      {
        id: "a-base-cabinet-2",
        wallId: "A",
        tier: "base",
        kind: "cabinet",
        widthSixteenths: 30 * 16,
        label: "B30",
        cabinetKind: "base",
        standardWidthSixteenths: 30 * 16
      },
      {
        id: "a-base-filler",
        wallId: "A",
        tier: "base",
        kind: "filler",
        widthSixteenths: 6 * 16,
        label: "F6"
      }
    ]
  };
}

// 120″ wall with a 40″ window centered at 60″, and a 30″ sink anchored under
// it. Fillers flank the sink on both sides so each side can absorb edits.
function wallWithAnchoredSink(): Round2Wall {
  return {
    id: "A",
    label: "A",
    sourceWall: "TOP",
    lengthSixteenths: 120 * 16,
    fixedPoints: [
      {
        id: "a-window",
        type: "window",
        label: "Window",
        sourceWall: "TOP",
        order: 0,
        positionRatio: 0.5,
        widthSixteenths: 40 * 16,
        offsetSixteenths: 40 * 16
      }
    ],
    notes: [],
    segments: [
      {
        id: "a-left-cabinet",
        wallId: "A",
        tier: "base",
        kind: "cabinet",
        widthSixteenths: 30 * 16,
        label: "B30",
        cabinetKind: "base",
        standardWidthSixteenths: 30 * 16
      },
      {
        id: "a-left-filler",
        wallId: "A",
        tier: "base",
        kind: "filler",
        widthSixteenths: 15 * 16,
        label: "F15"
      },
      {
        id: "a-sink",
        wallId: "A",
        tier: "base",
        kind: "appliance",
        widthSixteenths: 30 * 16,
        label: "SB30",
        cabinetKind: "sink",
        standardWidthSixteenths: 30 * 16,
        sourceFixedPointId: "a-sink-point",
        anchored: true
      },
      {
        id: "a-right-filler",
        wallId: "A",
        tier: "base",
        kind: "filler",
        widthSixteenths: 15 * 16,
        label: "F15"
      },
      {
        id: "a-right-cabinet",
        wallId: "A",
        tier: "base",
        kind: "cabinet",
        widthSixteenths: 30 * 16,
        label: "B30",
        cabinetKind: "base",
        standardWidthSixteenths: 30 * 16
      }
    ]
  };
}

function wallWithCabinetBesideAppliance(
  label: string,
  applianceWidth: number
): Round2Wall {
  return {
    id: "A",
    label: "A",
    sourceWall: "TOP",
    lengthSixteenths: 60 * 16 + applianceWidth,
    fixedPoints: [],
    notes: [],
    segments: [
      {
        id: "a-left-cabinet",
        wallId: "A",
        tier: "base",
        kind: "cabinet",
        widthSixteenths: 30 * 16,
        label: "B30",
        cabinetKind: "base"
      },
      {
        id: `a-${label.toLowerCase()}`,
        wallId: "A",
        tier: "base",
        kind: "appliance",
        widthSixteenths: applianceWidth,
        label,
        cabinetKind: label.startsWith("SB") ? "sink" : undefined,
        sourceFixedPointId: `top-appliance-${label.toLowerCase()}`
      },
      {
        id: "a-right-filler",
        wallId: "A",
        tier: "base",
        kind: "filler",
        widthSixteenths: 0,
        label: "F0"
      },
      {
        id: "a-right-cabinet",
        wallId: "A",
        tier: "base",
        kind: "cabinet",
        widthSixteenths: 30 * 16,
        label: "B30",
        cabinetKind: "base"
      }
    ]
  };
}

function findSeg(wall: Round2Wall, id: string) {
  return wall.segments.find((segment) => segment.id === id);
}

function modelWithWall(wall: Round2Wall): Round2Model {
  return {
    walls: [wall],
    ceilingHeightSixteenths: 96 * 16,
    decisionItems: []
  };
}

function segmentWidth(wall: Round2Wall, id: string): number | undefined {
  return wall.segments.find((segment) => segment.id === id)?.widthSixteenths;
}

function segmentStart(wall: Round2Wall, id: string): number {
  let start = 0;
  for (const segment of wall.segments) {
    if (segment.tier !== "base") continue;
    if (segment.id === id) return start;
    start += segment.widthSixteenths;
  }
  throw new Error(`Segment ${id} not found`);
}
