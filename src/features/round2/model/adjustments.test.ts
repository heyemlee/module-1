import { describe, expect, test } from "vitest";
import type { Round2Model, Round2Wall } from "./round2-model";
import {
  moveFillerEnd,
  nudgeGroup,
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

    expect(segmentWidth(wall, "a-base-filler")).toBe(0);
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
