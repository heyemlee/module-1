import { describe, expect, test } from "vitest";
import {
  autofillRound2Model,
  autofillWall
} from "./autofill";
import { CABINET_STANDARDS } from "./cabinet-standards";
import type { Round2Model, Round2Wall } from "./round2-model";

describe("Round 2 autofill", () => {
  test("keeps each generated tier closed to the measured wall length", () => {
    const wall = wallWithLength(100 * 16 + 4);
    const segments = autofillWall(wall);

    for (const tier of ["upper", "base"] as const) {
      const total = segments
        .filter((segment) => segment.tier === tier)
        .reduce((sum, segment) => sum + segment.widthSixteenths, 0);
      expect(total).toBe(wall.lengthSixteenths);
    }
  });

  test("is deterministic for the same measured model", () => {
    const model = modelWithWall(wallWithLength(120 * 16));

    expect(autofillRound2Model(model)).toEqual(autofillRound2Model(model));
  });

  test("emits a decision item for filler below the minimum", () => {
    const model = autofillRound2Model(modelWithWall(wallWithLength(36 * 16 + 4)));

    expect(model.decisionItems).toHaveLength(2);
    expect(model.decisionItems[0].body).toContain("1/2");
    expect(
      model.walls[0].segments.some(
        (segment) =>
          segment.kind === "filler" &&
          segment.widthSixteenths <
            CABINET_STANDARDS.filler.minSixteenths
      )
    ).toBe(true);
  });

  test.each([
    {
      symbol: "dishwasher",
      expected: CABINET_STANDARDS.appliances.dishwasher
    },
    {
      symbol: "range",
      expected: CABINET_STANDARDS.appliances.range
    },
    {
      symbol: "sink",
      expected: {
        widthSixteenths:
          CABINET_STANDARDS.appliances.sinkBase.defaultWidthSixteenths,
        label: `${CABINET_STANDARDS.appliances.sinkBase.labelPrefix}${
          CABINET_STANDARDS.appliances.sinkBase.defaultWidthSixteenths / 16
        }`
      }
    },
    {
      symbol: "fridge",
      expected: CABINET_STANDARDS.appliances.refrigerator
    }
  ])("preserves the $symbol appliance reservation", ({ symbol, expected }) => {
    const wall = wallWithLength(120 * 16);
    wall.fixedPoints = [
      {
        id: `fixed-${symbol}`,
        type: "appliance",
        label: symbol,
        sourceWall: "TOP",
        order: 0,
        positionRatio: 0.5,
        symbol
      }
    ];

    const filled = autofillRound2Model(modelWithWall(wall));
    const appliance = filled.walls[0].segments.find(
      (segment) => segment.tier === "base" && segment.kind === "appliance"
    );

    expect(appliance).toMatchObject(expected);
  });
});

function wallWithLength(lengthSixteenths: number): Round2Wall {
  return {
    id: "A",
    label: "A",
    sourceWall: "TOP",
    lengthSixteenths,
    fixedPoints: [],
    segments: [],
    notes: []
  };
}

function modelWithWall(wall: Round2Wall): Round2Model {
  return {
    ceilingHeightSixteenths: 96 * 16,
    walls: [wall],
    decisionItems: []
  };
}
