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
    expect(model.decisionItems[0].body).toContain("3/4");
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
      expected: expectedAppliance(CABINET_STANDARDS.appliances.dishwasher)
    },
    {
      symbol: "range",
      expected: expectedAppliance(CABINET_STANDARDS.appliances.range)
    },
    {
      symbol: "sink",
      expected: expectedAppliance(CABINET_STANDARDS.appliances.sinkBase)
    },
    {
      symbol: "fridge",
      expected: expectedAppliance(CABINET_STANDARDS.appliances.refrigerator)
    }
  ])("preserves the $symbol appliance reservation", ({ symbol, expected }) => {
    const filled = autofillRound2Model(
      modelWithWall(wallWithAppliance(symbol))
    );
    const appliance = filled.walls[0].segments.find(
      (segment) => segment.tier === "base" && segment.kind === "appliance"
    );

    expect(appliance).toMatchObject(expected);
  });

  test("uses a customer-provided fixed-point width over the default", () => {
    const filled = autofillRound2Model(
      modelWithWall(wallWithAppliance("range", 33 * 16))
    );
    const range = filled.walls[0].segments.find(
      (segment) => segment.sourceFixedPointId === "fixed-range"
    );

    expect(range).toMatchObject({
      widthSixteenths: 33 * 16,
      label: "RNG33"
    });
  });

  test("does not reserve base width for a hood", () => {
    const filled = autofillRound2Model(
      modelWithWall(wallWithAppliance("hood"))
    );

    expect(
      filled.walls[0].segments.some(
        (segment) => segment.sourceFixedPointId === "fixed-hood"
      )
    ).toBe(false);
    expect(filled.decisionItems).toHaveLength(0);
  });

  test.each(["oven", "microwave"])(
    "blocks %s autofill when no customer width is available",
    (symbol) => {
      const filled = autofillRound2Model(
        modelWithWall(wallWithAppliance(symbol))
      );

      expect(
        filled.walls[0].segments.some(
          (segment) => segment.sourceFixedPointId === `fixed-${symbol}`
        )
      ).toBe(false);
      expect(filled.decisionItems).toContainEqual(
        expect.objectContaining({
          objectId: `fixed-${symbol}`,
          severity: "blocking",
          title: "Appliance width required"
        })
      );
    }
  );
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

function wallWithAppliance(
  symbol: string,
  widthSixteenths?: number
): Round2Wall {
  const wall = wallWithLength(120 * 16);
  wall.fixedPoints = [
    {
      id: `fixed-${symbol}`,
      type: "appliance",
      label: symbol,
      sourceWall: "TOP",
      order: 0,
      positionRatio: 0.5,
      symbol,
      widthSixteenths
    }
  ];
  return wall;
}

function expectedAppliance(definition: {
  defaultWidthSixteenths: number;
  labelPrefix: string;
}) {
  return {
    widthSixteenths: definition.defaultWidthSixteenths,
    label: `${definition.labelPrefix}${
      definition.defaultWidthSixteenths / 16
    }`
  };
}
