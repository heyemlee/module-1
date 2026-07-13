import { describe, expect, test } from "vitest";
import type {
  FloorPlan,
  Wall
} from "@/features/round1/floorplan/plan-geometry";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { deriveWallsFromRound1 } from "./derive-walls";

describe("deriveWallsFromRound1", () => {
  test.each([
    ["ONE_WALL", ["TOP"], ["A"]],
    ["LEFT_L_SHAPE", ["TOP", "LEFT"], ["A", "B"]],
    ["RIGHT_L_SHAPE", ["TOP", "RIGHT"], ["A", "B"]],
    ["U_SHAPE", ["TOP", "RIGHT", "LEFT"], ["A", "B", "C"]],
    ["GALLEY", ["TOP", "BOTTOM"], ["A", "B"]]
  ])("derives %s topology", (layout, sourceWalls, labels) => {
    const model = deriveWallsFromRound1(planFor(layout, sourceWalls as Wall[]));

    expect(model.walls.map((wall) => wall.sourceWall)).toEqual(sourceWalls);
    expect(model.walls.map((wall) => wall.label)).toEqual(labels);
    expect(model.walls.every((wall) => wall.lengthSixteenths == null)).toBe(
      true
    );
  });

  test("keeps fixed openings on their owning wall by relative order", () => {
    const model = deriveWallsFromRound1(ROUND1_REFERENCE_FIXTURE.floorPlan);
    const wallA = model.walls.find((wall) => wall.label === "A");

    expect(wallA?.sourceWall).toBe("TOP");
    expect(wallA?.fixedPoints.map((point) => point.type)).toContain("window");
    expect(wallA?.fixedPoints[0]?.sourceWall).toBe("TOP");
  });
});

function planFor(layoutPreference: string, walls: Wall[]): FloorPlan {
  return {
    ...ROUND1_REFERENCE_FIXTURE.floorPlan,
    layoutPreference,
    baseCabinets: walls.map((wall, index) => ({
      x: 100 + index * 40,
      y: 100,
      w: 40,
      h: 24,
      code: `B${index}`,
      confirmationRequired: false,
      wall
    })),
    wallCabinets: [],
    appliances: [],
    window: walls.includes("TOP")
      ? { x: 310, y: 58, w: 112, h: 8, wall: "TOP" }
      : null,
    door: null,
    markers: []
  };
}
