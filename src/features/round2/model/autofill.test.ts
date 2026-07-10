import { describe, expect, test } from "vitest";
import { autofillRound2Model } from "./autofill";
import { CABINET_STANDARDS } from "./cabinet-standards";
import type { Round2DesignIntent } from "./design-intent";
import type {
  Round2FixedPoint,
  Round2Model,
  Round2Wall,
  WallSegment
} from "./round2-model";

describe("Round 2 autofill", () => {
  test("keeps each generated tier closed to the measured wall length", () => {
    const model = autofillRound2Model(
      modelWithWall(wallWithLength(100 * 16 + 4))
    );

    expectTiersClosed(model);
  });

  test("is deterministic for the same measured model and intent", () => {
    const model = uShapeModel();
    const intent = intentWith({
      "corner.TL.strategy": "lazySusan",
      "corner.TR.strategy": "blindBase"
    });

    expect(autofillRound2Model(model, {}, intent)).toEqual(
      autofillRound2Model(model, {}, intent)
    );
  });

  test("lazy Susan intent yields the corner tier on both walls", () => {
    const filled = autofillRound2Model(
      uShapeModel(),
      {},
      intentWith({
        "corner.TL.strategy": "lazySusan",
        "corner.TR.strategy": "lazySusan"
      })
    );
    const width = 36 * 16;
    const top = filled.walls.find((wall) => wall.sourceWall === "TOP")!;
    const topBase = baseTier(top);

    expect(topBase[0]).toMatchObject({
      kind: "cabinet",
      cabinetKind: "corner",
      label: "LS36",
      widthSixteenths: width,
      sourceCornerId: "TL"
    });
    expect(topBase[topBase.length - 1]).toMatchObject({
      cabinetKind: "corner",
      sourceCornerId: "TR",
      widthSixteenths: width
    });

    for (const sourceWall of ["LEFT", "RIGHT"] as const) {
      const wall = filled.walls.find((item) => item.sourceWall === sourceWall)!;
      expect(baseTier(wall)[0]).toMatchObject({
        kind: "gap",
        widthSixteenths: width,
        sourceCornerId: sourceWall === "LEFT" ? "TL" : "TR"
      });
    }
    expectTiersClosed(filled);
  });

  test("blind base intent consumes the blind width plus the adjacent pull", () => {
    const filled = autofillRound2Model(
      uShapeModel(),
      {},
      intentWith({ "corner.TL.strategy": "blindBase" })
    );
    const top = filled.walls.find((wall) => wall.sourceWall === "TOP")!;
    const left = filled.walls.find((wall) => wall.sourceWall === "LEFT")!;
    const leftBase = baseTier(left);

    expect(baseTier(top)[0]).toMatchObject({
      cabinetKind: "corner",
      label: "BB45",
      widthSixteenths: 45 * 16
    });
    expect(leftBase[0]).toMatchObject({
      kind: "gap",
      widthSixteenths: CABINET_STANDARDS.depths.baseSixteenths
    });
    expect(leftBase[1]).toMatchObject({
      kind: "filler",
      widthSixteenths:
        CABINET_STANDARDS.corner.blindBase.adjacentWallPullSixteenths
    });
  });

  test.each([
    ["magicCorner", "magicCorner"],
    ["blindCornerPullOut", "blindCornerPullOut"],
    ["cornerPullOutShelves", "cornerPullOutShelves"]
  ] as const)(
    "%s intent uses blind-base geometry with the selected corner hardware",
    (strategy, accessory) => {
      const filled = autofillRound2Model(
        uShapeModel(),
        {},
        intentWith({ "corner.TL.strategy": strategy })
      );
      const top = filled.walls.find((wall) => wall.sourceWall === "TOP")!;
      const left = filled.walls.find((wall) => wall.sourceWall === "LEFT")!;

      expect(baseTier(top)[0]).toMatchObject({
        cabinetKind: "corner",
        label: "BB45",
        front: { accessories: [accessory] },
        widthSixteenths: 45 * 16
      });
      expect(baseTier(left)[0]).toMatchObject({
        kind: "gap",
        widthSixteenths: CABINET_STANDARDS.depths.baseSixteenths
      });
    }
  );

  test("defaults to a lazy Susan corner instead of a dead corner", () => {
    const filled = autofillRound2Model(uShapeModel());
    const width = 36 * 16;
    const top = filled.walls.find((wall) => wall.sourceWall === "TOP")!;
    const left = filled.walls.find((wall) => wall.sourceWall === "LEFT")!;

    expect(baseTier(top)[0]).toMatchObject({
      kind: "cabinet",
      cabinetKind: "corner",
      widthSixteenths: width,
      label: "LS36",
      sourceCornerId: "TL"
    });
    expect(baseTier(left)[0]).toMatchObject({
      kind: "gap",
      widthSixteenths: width,
      label: "LS36 return",
      sourceCornerId: "TL"
    });
    expect(filled.walls.flatMap((wall) => wall.segments).map((segment) => segment.label))
      .not.toContain("Dead corner");
  });

  test("centers the sink cabinet under the measured window", () => {
    const wall = wallWithLength(200 * 16);
    wall.fixedPoints = [
      fixedPoint({
        id: "top-window",
        type: "window",
        positionRatio: 0.4,
        widthSixteenths: 30 * 16,
        offsetSixteenths: 60 * 16
      }),
      fixedPoint({ id: "top-appliance-sink", symbol: "sink", positionRatio: 0.2 })
    ];
    const filled = autofillRound2Model(modelWithWall(wall));
    const base = baseTier(filled.walls[0]);
    const sink = segmentWithStart(base, (segment) => segment.cabinetKind === "sink");

    const windowCenter = 60 * 16 + 15 * 16;
    expect(sink.segment.widthSixteenths).toBe(36 * 16);
    expect(sink.start + 18 * 16).toBe(windowCenter);
    // A sink centered under the window is anchored so later cabinet edits
    // redistribute width around it rather than sliding it off center.
    expect(sink.segment.anchored).toBe(true);
  });

  test("docks the dishwasher against the sink", () => {
    const wall = wallWithLength(200 * 16);
    wall.fixedPoints = [
      fixedPoint({ id: "top-appliance-sink", symbol: "sink", positionRatio: 0.5 }),
      fixedPoint({
        id: "top-appliance-dishwasher",
        symbol: "dishwasher",
        positionRatio: 0.3
      })
    ];
    const filled = autofillRound2Model(modelWithWall(wall));
    const base = baseTier(filled.walls[0]);
    const sink = segmentWithStart(base, (segment) => segment.cabinetKind === "sink");
    const dishwasher = segmentWithStart(
      base,
      (segment) => segment.sourceFixedPointId === "top-appliance-dishwasher"
    );

    expect(dishwasher.start + dishwasher.segment.widthSixteenths).toBe(sink.start);
  });

  test("pushes the remainder filler to the wall end, never between cabinets", () => {
    const filled = autofillRound2Model(modelWithWall(wallWithLength(100 * 16)));

    for (const tier of ["upper", "base"] as const) {
      const run = filled.walls[0].segments.filter(
        (segment) => segment.tier === tier
      );
      for (const [index, segment] of run.entries()) {
        if (segment.kind !== "filler") continue;
        const left = run[index - 1];
        const right = run[index + 1];
        expect(left?.kind === "cabinet" && right?.kind === "cabinet").toBe(false);
      }
      expect(run[run.length - 1].kind).toBe("filler");
    }
  });

  test("steps a cabinet down a width tier to lift a sliver filler", () => {
    // 100″ greedy fill would leave a 1″ remainder; one 36→33 step turns it
    // into a 4″ filler at the wall end.
    const filled = autofillRound2Model(modelWithWall(wallWithLength(100 * 16)));
    const base = baseTier(filled.walls[0]);
    const filler = base.find((segment) => segment.kind === "filler");

    expect(filler?.widthSixteenths).toBe(4 * 16);
    expect(
      filled.decisionItems.filter((item) => item.title.includes("filler"))
    ).toHaveLength(0);
  });

  test("partitions a 42-inch ordinary base span without a filler", () => {
    const filled = autofillRound2Model(modelWithWall(wallWithLength(42 * 16)));
    const base = baseTier(filled.walls[0]);

    expect(
      base
        .filter((segment) => segment.kind === "cabinet")
        .map((segment) => segment.widthSixteenths)
    ).toEqual([33 * 16, 9 * 16]);
    expect(base.filter((segment) => segment.kind === "filler")).toHaveLength(0);
    expect(base.filter((segment) => segment.kind === "gap")).toHaveLength(0);
    expectTiersClosed(filled);
  });

  test("repartitions a seven-inch residual into one valid filler", () => {
    const filled = autofillRound2Model(modelWithWall(wallWithLength(43 * 16)));
    const base = baseTier(filled.walls[0]);

    expect(base.filter((segment) => segment.kind === "filler")).toEqual([
      expect.objectContaining({ widthSixteenths: 4 * 16 })
    ]);
    expect(
      base
        .filter((segment) => segment.kind === "cabinet")
        .map((segment) => segment.widthSixteenths)
    ).toEqual([30 * 16, 9 * 16]);
    expectTiersClosed(filled);
  });

  test("emits a blocking gap when no valid cabinet-plus-filler partition exists", () => {
    // 9 1/16″ cannot leave an exact cabinet total or an approved 3–6″ filler.
    const filled = autofillRound2Model(modelWithWall(wallWithLength(9 * 16 + 1)));
    const base = baseTier(filled.walls[0]);

    expect(base.filter((segment) => segment.kind === "cabinet")).toHaveLength(0);
    expect(base.filter((segment) => segment.kind === "filler")).toHaveLength(0);
    expect(base).toContainEqual(
      expect.objectContaining({ kind: "gap", widthSixteenths: 9 * 16 + 1 })
    );
    expect(filled.decisionItems).toContainEqual(
      expect.objectContaining({
        severity: "blocking",
        title: expect.stringContaining("gap below filler minimum")
      })
    );
  });

  test.each([
    { ceiling: 96 * 16, expectedUpper: 36 * 16 },
    { ceiling: 108 * 16, expectedUpper: 42 * 16 }
  ])(
    "derives a $expectedUpper sixteenths upper tier from a $ceiling ceiling",
    ({ ceiling, expectedUpper }) => {
      const filled = autofillRound2Model(modelWithWall(wallWithLength(120 * 16)), {
        "room.ceiling": ceiling
      });

      expect(filled.heightProfile).toMatchObject({
        counterSixteenths: 36 * 16,
        backsplashSixteenths: 18 * 16,
        upperHeightSixteenths: expectedUpper,
        mouldingSixteenths: 3 * 16
      });
    }
  );

  test("flags the reveal when uppers cannot close to the ceiling", () => {
    const filled = autofillRound2Model(
      modelWithWall(wallWithLength(120 * 16)),
      { "room.ceiling": 108 * 16 },
      intentWith({ "uppers.termination": "ceiling" })
    );

    expect(filled.decisionItems).toContainEqual(
      expect.objectContaining({ id: "decision-height-ceiling-closure" })
    );
  });

  test("derives the hood from the range width and carves the window above the sink", () => {
    const wall = wallWithLength(200 * 16);
    wall.fixedPoints = [
      fixedPoint({
        id: "top-window",
        type: "window",
        positionRatio: 0.3,
        widthSixteenths: 30 * 16,
        offsetSixteenths: 45 * 16
      }),
      fixedPoint({ id: "top-appliance-sink", symbol: "sink", positionRatio: 0.3 }),
      fixedPoint({ id: "top-appliance-range", symbol: "range", positionRatio: 0.75 })
    ];
    const filled = autofillRound2Model(modelWithWall(wall));
    const wallResult = filled.walls[0];
    const uppers = wallResult.segments.filter((s) => s.tier === "upper");
    const range = segmentWithStart(
      baseTier(wallResult),
      (segment) => segment.sourceFixedPointId === "top-appliance-range"
    );
    const hood = segmentWithStart(uppers, (segment) =>
      segment.label.startsWith("HD")
    );

    expect(hood.segment.widthSixteenths).toBe(range.segment.widthSixteenths);
    expect(hood.start).toBe(range.start);
    expect(uppers).toContainEqual(
      expect.objectContaining({ kind: "opening", widthSixteenths: 30 * 16 })
    );
    expectTiersClosed(filled);
  });

  test("hugs the fridge to the wall end as one full-height unit with a gap above", () => {
    const wall = wallWithLength(200 * 16);
    wall.fixedPoints = [
      fixedPoint({ id: "top-appliance-fridge", symbol: "fridge", positionRatio: 0.9 })
    ];
    const filled = autofillRound2Model(modelWithWall(wall));
    const base = baseTier(filled.walls[0]);
    const fridge = segmentWithStart(
      base,
      (segment) => segment.sourceFixedPointId === "top-appliance-fridge"
    );

    expect(fridge.start + fridge.segment.widthSixteenths).toBe(200 * 16);
    // No separate deep upper: the fridge is a single full-height unit, so the
    // upper tier leaves a gap over it (never a WR cabinet).
    expect(
      filled.walls[0].segments.some(
        (segment) => segment.tier === "upper" && segment.label.startsWith("WR")
      )
    ).toBe(false);
    const upperOverFridge = filled.walls[0].segments.find(
      (segment) =>
        segment.tier === "upper" &&
        segment.sourceFixedPointId === "top-appliance-fridge"
    );
    expect(upperOverFridge?.kind).toBe("gap");
  });

  test("tags the range flank as a drawer base and the sink side for trash", () => {
    const wall = wallWithLength(250 * 16);
    wall.fixedPoints = [
      fixedPoint({ id: "top-appliance-sink", symbol: "sink", positionRatio: 0.2 }),
      fixedPoint({ id: "top-appliance-range", symbol: "range", positionRatio: 0.8 })
    ];
    const filled = autofillRound2Model(modelWithWall(wall));
    const base = baseTier(filled.walls[0]);
    const sinkIndex = base.findIndex((segment) => segment.cabinetKind === "sink");
    const rangeIndex = base.findIndex(
      (segment) => segment.sourceFixedPointId === "top-appliance-range"
    );

    expect(
      [base[rangeIndex - 1], base[rangeIndex + 1]].some((segment) =>
        segment?.label.startsWith("DB")
      )
    ).toBe(true);
    expect(
      base
        .slice(sinkIndex + 1)
        .find((segment) => segment.kind === "cabinet")
        ?.label.startsWith("WB")
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
    const filled = autofillRound2Model(modelWithWall(wallWithAppliance(symbol)));
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
      (segment) =>
        segment.tier === "base" &&
        segment.sourceFixedPointId === "fixed-range"
    );

    expect(range).toMatchObject({
      widthSixteenths: 33 * 16,
      label: "RNG33"
    });
  });

  test("does not reserve base width for a hood", () => {
    const filled = autofillRound2Model(modelWithWall(wallWithAppliance("hood")));

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
      const filled = autofillRound2Model(modelWithWall(wallWithAppliance(symbol)));

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

function expectTiersClosed(model: Round2Model) {
  for (const wall of model.walls) {
    if (wall.lengthSixteenths == null) continue;
    for (const tier of ["upper", "base"] as const) {
      const total = wall.segments
        .filter((segment) => segment.tier === tier)
        .reduce((sum, segment) => sum + segment.widthSixteenths, 0);
      expect(total).toBe(wall.lengthSixteenths);
    }
  }
}

function baseTier(wall: Round2Wall): WallSegment[] {
  return wall.segments.filter((segment) => segment.tier === "base");
}

function segmentWithStart(
  segments: WallSegment[],
  predicate: (segment: WallSegment) => boolean
): { segment: WallSegment; start: number } {
  let start = 0;
  for (const segment of segments) {
    if (predicate(segment)) return { segment, start };
    start += segment.widthSixteenths;
  }
  throw new Error("segment not found");
}

function intentWith(
  answers: Record<string, string>
): Round2DesignIntent {
  return {
    answers: answers as Round2DesignIntent["answers"],
    confirmedKeys: Object.keys(answers)
  };
}

function wallWithLength(
  lengthSixteenths: number,
  sourceWall: Round2Wall["sourceWall"] = "TOP",
  id = "A"
): Round2Wall {
  return {
    id,
    label: id,
    sourceWall,
    lengthSixteenths,
    fixedPoints: [],
    segments: [],
    notes: []
  };
}

function uShapeModel(): Round2Model {
  return {
    ceilingHeightSixteenths: 96 * 16,
    walls: [
      wallWithLength(120 * 16, "TOP", "A"),
      wallWithLength(120 * 16, "RIGHT", "B"),
      wallWithLength(120 * 16, "LEFT", "C")
    ],
    decisionItems: []
  };
}

function modelWithWall(wall: Round2Wall): Round2Model {
  return {
    ceilingHeightSixteenths: 96 * 16,
    walls: [wall],
    decisionItems: []
  };
}

function fixedPoint(
  overrides: Partial<Round2FixedPoint> & { id: string }
): Round2FixedPoint {
  return {
    type: "appliance",
    label: overrides.symbol ?? overrides.type ?? "fixture",
    sourceWall: "TOP",
    order: overrides.positionRatio ?? 0,
    positionRatio: 0.5,
    ...overrides
  };
}

function wallWithAppliance(
  symbol: string,
  widthSixteenths?: number
): Round2Wall {
  const wall = wallWithLength(120 * 16);
  wall.fixedPoints = [
    fixedPoint({ id: `fixed-${symbol}`, symbol, positionRatio: 0.5, widthSixteenths })
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
