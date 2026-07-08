import { describe, expect, test } from "vitest";
import type { Round2Model, Round2Wall } from "./round2-model";
import {
  heightProfileTotal,
  moveFillerEnd,
  nudgeGroup,
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

  test("moves selected filler to the requested end of its tier", () => {
    const adjusted = moveFillerEnd(
      modelWithWall(wallWithSegments()),
      "a-base-filler",
      "start"
    );
    const baseIds = adjusted.walls[0].segments
      .filter((segment) => segment.tier === "base")
      .map((segment) => segment.id);

    expect(baseIds[0]).toBe("a-base-filler");
  });

  test("sets a base cabinet kind to sink without changing width", () => {
    const adjusted = setSegmentKind(
      modelWithWall(wallWithSegments()),
      "a-base-cabinet",
      "sink"
    );
    const segment = adjusted.walls[0].segments.find(
      (item) => item.id === "a-base-cabinet"
    );

    expect(segment?.cabinetKind).toBe("sink");
    expect(segment?.label).toBe("SB30");
  });

  test("accepts a custom width from the width-chain input", () => {
    const model = modelWithWall(wallWithSegments());
    const adjusted = stepCabinetWidth(model, "a-base-cabinet", 31 * 16 + 8);
    const wall = adjusted.walls[0];

    expect(segmentWidth(wall, "a-base-cabinet")).toBe(31 * 16 + 8);
    expect(wallTierTotal(wall, "base")).toBe(wall.lengthSixteenths);
  });

  test("rejects zero or fractional custom widths", () => {
    const model = modelWithWall(wallWithSegments());
    expect(stepCabinetWidth(model, "a-base-cabinet", 0)).toBe(model);
    expect(stepCabinetWidth(model, "a-base-cabinet", 30.5)).toBe(model);
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

  test("describes the configured 3/4-inch filler minimum", () => {
    const wall = wallWithSegments();
    wall.segments = wall.segments.map((segment) =>
      segment.id === "a-base-filler"
        ? { ...segment, widthSixteenths: 8 }
        : segment
    );
    wall.lengthSixteenths = wallTierTotal(wall, "base");

    const updated = updateModelDecisions(modelWithWall(wall));

    expect(updated.decisionItems[0].body).toContain("3/4");
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
