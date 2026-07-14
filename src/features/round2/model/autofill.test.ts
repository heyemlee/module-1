import { describe, expect, test } from "vitest";
import { stepCabinetWidth } from "./adjustments";
import { autofillRound2Model } from "./autofill";
import { CABINET_STANDARDS } from "./cabinet-standards";
import type { Round2DesignIntent } from "./design-intent";
import {
  sinkCenteringOffsetSixteenths,
  type Round2FixedPoint,
  type Round2Model,
  type Round2Wall,
  type WallSegment
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

  test("turns upper corners with a diagonal wall cabinet by default", () => {
    const filled = autofillRound2Model(uShapeModel());
    const top = filled.walls.find((wall) => wall.sourceWall === "TOP")!;
    const left = filled.walls.find((wall) => wall.sourceWall === "LEFT")!;
    const topUpper = upperTier(top);
    const leftUpper = upperTier(left);

    expect(topUpper[0]).toMatchObject({
      kind: "cabinet",
      cabinetKind: "corner",
      label: "WDC24",
      widthSixteenths: 24 * 16,
      sourceCornerId: "TL"
    });
    expect(leftUpper[0]).toMatchObject({
      kind: "gap",
      label: "WDC24 return",
      widthSixteenths: 24 * 16,
      sourceCornerId: "TL"
    });
    // The wall over the base corner body beyond the diagonal unit is ordinary
    // upper space, not a 36″ clearance copied from the base tier: the whole
    // 96″ run repartitions as its own standard-width run.
    expect(leftUpper[1]).toMatchObject({
      kind: "cabinet",
      widthSixteenths: 36 * 16
    });
    expect(
      filled.walls
        .flatMap((wall) => wall.segments)
        .filter((segment) => segment.label === "Corner clearance")
    ).toHaveLength(0);
    expectTiersClosed(filled);
  });

  test("blind upper intent keeps the upper straight and yields depth plus pull", () => {
    const filled = autofillRound2Model(
      uShapeModel(),
      {},
      intentWith({ "corner.TL.upper": "blindUpper" })
    );
    const top = filled.walls.find((wall) => wall.sourceWall === "TOP")!;
    const left = filled.walls.find((wall) => wall.sourceWall === "LEFT")!;
    const leftUpper = upperTier(left);

    expect(upperTier(top)[0]).toMatchObject({
      kind: "cabinet",
      cabinetKind: "corner",
      label: "WBC30",
      widthSixteenths: 30 * 16
    });
    expect(leftUpper[0]).toMatchObject({
      kind: "gap",
      label: "Blind upper",
      widthSixteenths: CABINET_STANDARDS.depths.upperSixteenths
    });
    expect(leftUpper[1]).toMatchObject({
      kind: "filler",
      widthSixteenths:
        CABINET_STANDARDS.corner.upperBlind.adjacentWallPullSixteenths
    });
    expectTiersClosed(filled);
  });

  test("open upper intent leaves the corner empty and clears the primary depth", () => {
    const filled = autofillRound2Model(
      uShapeModel(),
      {},
      intentWith({ "corner.TL.upper": "openUpper" })
    );
    const top = filled.walls.find((wall) => wall.sourceWall === "TOP")!;
    const left = filled.walls.find((wall) => wall.sourceWall === "LEFT")!;

    // No corner unit: the primary run reaches the wall end as ordinary uppers.
    expect(upperTier(top)[0]).toMatchObject({
      kind: "cabinet",
      cabinetKind: "upper"
    });
    expect(upperTier(left)[0]).toMatchObject({
      kind: "gap",
      label: "Open upper corner",
      widthSixteenths: CABINET_STANDARDS.depths.upperSixteenths
    });
    expectTiersClosed(filled);
  });

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

  test("blocks an aligned sink displaced by a corner reservation", () => {
    const model = uShapeModel();
    const top = model.walls.find((wall) => wall.id === "A")!;
    top.fixedPoints = [
      fixedPoint({
        id: "top-window",
        type: "window",
        positionRatio: 0.3,
        widthSixteenths: 30 * 16,
        offsetSixteenths: 20 * 16
      }),
      fixedPoint({ id: "top-appliance-sink", symbol: "sink", positionRatio: 0.3 })
    ];

    const filled = autofillRound2Model(model);
    const wall = filled.walls.find((item) => item.id === "A")!;
    const sink = segmentWithStart(
      baseTier(wall),
      (segment) => segment.sourceFixedPointId === "top-appliance-sink"
    );
    const windowCenter = 20 * 16 + 15 * 16;

    expect(sink.start + sink.segment.widthSixteenths / 2).not.toBe(windowCenter);
    expect(sink.segment.anchored).toBe(false);
    expect(filled.decisionItems).toContainEqual(
      expect.objectContaining({
        id: "decision-top-appliance-sink-window-placement",
        objectId: "top-appliance-sink",
        severity: "blocking",
        title: "Sink placement conflicts with window alignment"
      })
    );
  });

  test("confirms the sink first so other appliances pack around it", () => {
    const wall = wallWithLength(200 * 16);
    wall.fixedPoints = [
      fixedPoint({
        id: "top-window",
        type: "window",
        positionRatio: 0.4,
        widthSixteenths: 30 * 16,
        offsetSixteenths: 60 * 16
      }),
      fixedPoint({ id: "top-appliance-sink", symbol: "sink", positionRatio: 0.35 }),
      // Desired range position overlaps the window-centered sink from the
      // left; the movable range must yield instead of displacing the sink.
      fixedPoint({
        id: "top-appliance-range",
        symbol: "range",
        positionRatio: 0.3
      })
    ];

    const filled = autofillRound2Model(modelWithWall(wall));
    const base = baseTier(filled.walls[0]);
    const sink = segmentWithStart(base, (segment) => segment.cabinetKind === "sink");
    const range = segmentWithStart(
      base,
      (segment) => segment.sourceFixedPointId === "top-appliance-range"
    );
    const windowCenter = 60 * 16 + 15 * 16;

    expect(sink.start + sink.segment.widthSixteenths / 2).toBe(windowCenter);
    expect(sink.segment.anchored).toBe(true);
    expect(range.start + range.segment.widthSixteenths).toBeLessThanOrEqual(
      sink.start
    );
    expect(filled.decisionItems).not.toContainEqual(
      expect.objectContaining({
        id: "decision-top-appliance-sink-window-placement"
      })
    );
    expectTiersClosed(filled);
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

  test("keeps a far-away dishwasher at its Round 1 spot when the intent says so", () => {
    const wall = wallWithLength(200 * 16);
    wall.fixedPoints = [
      fixedPoint({ id: "top-appliance-sink", symbol: "sink", positionRatio: 0.5 }),
      fixedPoint({
        id: "top-appliance-dishwasher",
        symbol: "dishwasher",
        positionRatio: 0.1
      })
    ];

    const kept = autofillRound2Model(
      modelWithWall(wall),
      {},
      intentWith({
        "dishwasher.top-appliance-dishwasher.placement": "keepRound1"
      })
    );
    const keptBase = baseTier(kept.walls[0]);
    const keptSink = segmentWithStart(
      keptBase,
      (segment) => segment.cabinetKind === "sink"
    );
    const keptDishwasher = segmentWithStart(
      keptBase,
      (segment) => segment.sourceFixedPointId === "top-appliance-dishwasher"
    );

    expect(
      keptDishwasher.start + keptDishwasher.segment.widthSixteenths
    ).not.toBe(keptSink.start);
    expect(keptDishwasher.start).toBe(Math.round(0.1 * (200 - 24) * 16));
    expectTiersClosed(kept);
  });

  test("nudges the range within tolerance so both neighboring runs close", () => {
    // 99″ wall: the ratio-placed range leaves 34 1/2″ on each side (two 4 1/2″
    // fillers); sliding it 1 1/2″ left closes both runs exactly (33″ + 36″).
    const wall = wallWithLength(99 * 16);
    wall.fixedPoints = [
      fixedPoint({ id: "top-appliance-range", symbol: "range", positionRatio: 0.5 })
    ];

    const filled = autofillRound2Model(modelWithWall(wall));
    const base = baseTier(filled.walls[0]);
    const range = segmentWithStart(
      base,
      (segment) => segment.sourceFixedPointId === "top-appliance-range"
    );

    expect(range.start).toBe(33 * 16);
    expect(base.filter((segment) => segment.kind === "filler")).toHaveLength(0);
    expect(filled.decisionItems).toHaveLength(0);
    expectTiersClosed(filled);
  });

  test("flags a range nudged off its gas mark as a warning", () => {
    const wall = wallWithLength(99 * 16);
    wall.fixedPoints = [
      fixedPoint({
        id: "top-marker-gas",
        type: "marker",
        symbol: "G",
        positionRatio: 0.5
      }),
      fixedPoint({ id: "top-appliance-range", symbol: "range", positionRatio: 0.5 })
    ];

    const filled = autofillRound2Model(modelWithWall(wall));
    const base = baseTier(filled.walls[0]);

    expect(base.filter((segment) => segment.kind === "filler")).toHaveLength(0);
    expect(filled.decisionItems).toContainEqual(
      expect.objectContaining({
        id: "decision-top-appliance-range-nudge",
        objectId: "top-appliance-range",
        severity: "warning",
        title: "Range nudged off the gas mark"
      })
    );
  });

  test("leaves the range on its mark when no nudge improves the runs", () => {
    // 96″ wall: 33″ on each side of the range already partitions exactly.
    const wall = wallWithLength(96 * 16);
    wall.fixedPoints = [
      fixedPoint({ id: "top-appliance-range", symbol: "range", positionRatio: 0.5 })
    ];

    const filled = autofillRound2Model(modelWithWall(wall));
    const range = segmentWithStart(
      baseTier(filled.walls[0]),
      (segment) => segment.sourceFixedPointId === "top-appliance-range"
    );

    expect(range.start).toBe(33 * 16);
    expect(filled.decisionItems).toHaveLength(0);
    expectTiersClosed(filled);
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

  test("fills an unresolvable span with confirmed filler strips", () => {
    // 9 1/16″ has no cabinet partition; the recorded resolution turns the base
    // span into approved strips (6″ + 3 1/16″) and clears the blocking gap.
    const filled = autofillRound2Model(
      modelWithWall(wallWithLength(9 * 16 + 1)),
      {},
      intentWith({
        "gap.a-base-1-gap.resolution": "fillerFill",
        "gap.a-upper-1-gap.resolution": "leaveOpen"
      })
    );
    const base = baseTier(filled.walls[0]);

    expect(base.filter((segment) => segment.kind === "gap")).toHaveLength(0);
    expect(
      base
        .filter((segment) => segment.kind === "filler")
        .map((segment) => segment.widthSixteenths)
    ).toEqual([6 * 16, 3 * 16 + 1]);
    expect(
      filled.decisionItems.filter((item) => item.severity === "blocking")
    ).toHaveLength(0);
    expectTiersClosed(filled);
  });

  test("keeps a confirmed open span as a labeled gap without blocking", () => {
    const filled = autofillRound2Model(
      modelWithWall(wallWithLength(9 * 16 + 1)),
      {},
      intentWith({
        "gap.a-base-1-gap.resolution": "leaveOpen",
        "gap.a-upper-1-gap.resolution": "leaveOpen"
      })
    );
    const base = baseTier(filled.walls[0]);

    expect(base).toContainEqual(
      expect.objectContaining({
        kind: "gap",
        label: "Open space",
        widthSixteenths: 9 * 16 + 1
      })
    );
    expect(
      filled.decisionItems.filter((item) => item.severity === "blocking")
    ).toHaveLength(0);
    expectTiersClosed(filled);
  });

  test("does not flag a confirmed below-minimum strip as an accidental sliver", () => {
    // A 2″ span can only be closed by a scribe strip below the 3″ minimum;
    // once confirmed, the strip carries no below-minimum warning.
    const filled = autofillRound2Model(
      modelWithWall(wallWithLength(2 * 16)),
      {},
      intentWith({
        "gap.a-base-1-gap.resolution": "fillerFill",
        "gap.a-upper-1-gap.resolution": "leaveOpen"
      })
    );
    const base = baseTier(filled.walls[0]);

    expect(base).toEqual([
      expect.objectContaining({ kind: "filler", widthSixteenths: 2 * 16 })
    ]);
    expect(
      filled.decisionItems.filter(
        (item) =>
          item.severity === "blocking" || item.title.includes("filler below")
      )
    ).toHaveLength(0);
    expectTiersClosed(filled);
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

  test("repartitions the upper runs beside a window instead of leaving slivers", () => {
    const wall = wallWithLength(200 * 16);
    wall.fixedPoints = [
      fixedPoint({
        id: "top-window",
        type: "window",
        positionRatio: 0.36,
        widthSixteenths: 24 * 16,
        offsetSixteenths: 60 * 16
      }),
      fixedPoint({ id: "top-appliance-sink", symbol: "sink", positionRatio: 0.36 })
    ];

    const filled = autofillRound2Model(modelWithWall(wall));
    const uppers = filled.walls[0].segments.filter(
      (segment) => segment.tier === "upper"
    );

    // The run left of the window (60″) closes exactly on standard widths; the
    // run right of it (116″) keeps one approved filler at the wall end instead
    // of a sliver against the window and an unexplained blank.
    expect(
      uppers.some(
        (segment) =>
          segment.kind === "cabinet" && segment.widthSixteenths < 9 * 16
      )
    ).toBe(false);
    expect(uppers.filter((segment) => segment.kind === "gap")).toHaveLength(0);
    expect(uppers.filter((segment) => segment.kind === "filler")).toEqual([
      expect.objectContaining({ widthSixteenths: 5 * 16 })
    ]);
    expect(uppers[uppers.length - 1].kind).toBe("filler");
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

  test("preserves appliance widths and a window-centered sink across rebalanced spans", () => {
    const wall = wallWithLength(242 * 16);
    wall.fixedPoints = [
      fixedPoint({
        id: "top-window",
        type: "window",
        positionRatio: 0.4,
        widthSixteenths: 30 * 16,
        offsetSixteenths: 80 * 16
      }),
      fixedPoint({
        id: "top-appliance-dishwasher",
        symbol: "dishwasher",
        positionRatio: 0.25
      }),
      fixedPoint({
        id: "top-appliance-sink",
        symbol: "sink",
        positionRatio: 0.4
      }),
      fixedPoint({
        id: "top-appliance-range",
        symbol: "range",
        positionRatio: 0.75
      })
    ];

    const filled = autofillRound2Model(modelWithWall(wall));
    const base = baseTier(filled.walls[0]);
    const dishwasher = segmentWithStart(
      base,
      (segment) =>
        segment.sourceFixedPointId === "top-appliance-dishwasher"
    );
    const sink = segmentWithStart(
      base,
      (segment) => segment.sourceFixedPointId === "top-appliance-sink"
    );
    const range = segmentWithStart(
      base,
      (segment) => segment.sourceFixedPointId === "top-appliance-range"
    );

    expect(dishwasher.segment.widthSixteenths).toBe(
      CABINET_STANDARDS.appliances.dishwasher.defaultWidthSixteenths
    );
    expect(sink.segment.widthSixteenths).toBe(
      CABINET_STANDARDS.appliances.sinkBase.defaultWidthSixteenths
    );
    expect(range.segment.widthSixteenths).toBe(
      CABINET_STANDARDS.appliances.range.defaultWidthSixteenths
    );
    expect(sink.segment.anchored).toBe(true);
    expect(sink.start + sink.segment.widthSixteenths / 2).toBe(
      80 * 16 + (30 * 16) / 2
    );
    // The range nudge closes both of its flanking spans exactly; only the
    // wall-start filler beyond the dishwasher (out of the range's reach)
    // remains.
    expect(
      base.filter((segment) => segment.kind === "filler").map(
        (segment) => segment.widthSixteenths
      )
    ).toEqual([5 * 16]);
    expectTiersClosed(filled);

    const adjacentCabinet = base[base.indexOf(sink.segment) + 1]!;
    expect(adjacentCabinet).toMatchObject({
      kind: "cabinet",
      cabinetKind: "base"
    });

    const adjusted = stepCabinetWidth(
      filled,
      adjacentCabinet.id,
      adjacentCabinet.widthSixteenths - 16
    );
    const adjustedWall = adjusted.walls[0];
    const adjustedBase = baseTier(adjustedWall);
    const adjustedDishwasher = adjustedBase.find(
      (segment) =>
        segment.sourceFixedPointId === "top-appliance-dishwasher"
    )!;
    const adjustedSink = adjustedBase.find(
      (segment) => segment.sourceFixedPointId === "top-appliance-sink"
    )!;
    const adjustedRange = adjustedBase.find(
      (segment) => segment.sourceFixedPointId === "top-appliance-range"
    )!;
    const adjustedCabinet = adjustedBase.find(
      (segment) => segment.id === adjacentCabinet.id
    )!;

    expect(adjustedCabinet.widthSixteenths).toBe(
      adjacentCabinet.widthSixteenths - 16
    );
    expect(adjustedDishwasher.widthSixteenths).toBe(
      dishwasher.segment.widthSixteenths
    );
    expect(adjustedSink.widthSixteenths).toBe(sink.segment.widthSixteenths);
    expect(adjustedRange.widthSixteenths).toBe(range.segment.widthSixteenths);
    expect(adjustedSink.anchored).toBe(true);
    expect(sinkCenteringOffsetSixteenths(adjustedWall, adjustedSink)).toBe(0);
    expect(
      adjusted.decisionItems.filter((item) => item.id.includes("off-center"))
    ).toHaveLength(0);
    expectTiersClosed(adjusted);
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

  test.each([
    {
      label: "appliance",
      point: fixedPoint({
        id: "fixed-range",
        symbol: "range",
        positionRatio: 0.5
      }),
      fixedPointId: "fixed-range",
      expectedKind: "appliance"
    },
    {
      label: "door opening",
      point: fixedPoint({
        id: "fixed-door",
        type: "door",
        label: "Door",
        positionRatio: 0,
        offsetSixteenths: 0,
        widthSixteenths: 30 * 16
      }),
      fixedPointId: "fixed-door",
      expectedKind: "opening"
    }
  ])("preserves a fixed $label that exceeds its available wall span", ({
    point,
    fixedPointId,
    expectedKind
  }) => {
    const wall = wallWithLength(24 * 16);
    wall.fixedPoints = [point];

    const filled = autofillRound2Model(modelWithWall(wall));
    const reserved = filled.walls[0].segments.find(
      (segment) =>
        segment.tier === "base" && segment.sourceFixedPointId === fixedPointId
    );

    expect(reserved).toMatchObject({
      kind: expectedKind,
      widthSixteenths: 30 * 16
    });
    expect(filled.decisionItems).toContainEqual(
      expect.objectContaining({
        objectId: fixedPointId,
        severity: "blocking",
        title: "Fixed reservation exceeds available wall space"
      })
    );
  });

  test("reports an aligned sink conflict when fixed reservations displace it", () => {
    const wall = wallWithLength(30 * 16);
    wall.fixedPoints = [
      fixedPoint({
        id: "top-appliance-range",
        symbol: "range",
        positionRatio: 0
      }),
      fixedPoint({
        id: "top-window",
        type: "window",
        positionRatio: 0.8,
        offsetSixteenths: 24 * 16,
        widthSixteenths: 30 * 16
      }),
      fixedPoint({
        id: "top-appliance-sink",
        symbol: "sink",
        positionRatio: 0.8
      })
    ];

    const filled = autofillRound2Model(modelWithWall(wall));

    expect(
      filled.walls[0].segments.find(
        (segment) => segment.sourceFixedPointId === "top-appliance-sink"
      )
    ).toMatchObject({ widthSixteenths: 36 * 16, anchored: false });
    expect(filled.decisionItems).toContainEqual(
      expect.objectContaining({
        id: "decision-top-appliance-sink-window-placement",
        severity: "blocking"
      })
    );
  });

  test("keeps corner reservations visible when their combined width overflows the wall", () => {
    const model = uShapeModel();
    model.walls = model.walls.map((wall) => ({
      ...wall,
      lengthSixteenths: 20 * 16
    }));

    const filled = autofillRound2Model(model);
    const top = filled.walls.find((wall) => wall.sourceWall === "TOP")!;
    const topCorners = baseTier(top).filter(
      (segment) => segment.sourceCornerId != null
    );

    expect(topCorners).toHaveLength(2);
    expect(
      topCorners.every((segment) => segment.widthSixteenths > 0)
    ).toBe(true);
    expect(
      new Set(topCorners.map((segment) => segment.sourceCornerId)).size
    ).toBe(2);
    expect(filled.decisionItems).toContainEqual(
      expect.objectContaining({
        id: `decision-${top.id}-corner-overflow`,
        severity: "blocking"
      })
    );
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

describe("Round 2 fridge surround", () => {
  function fridgeWall(): Round2Wall {
    const wall = wallWithLength(200 * 16);
    wall.fixedPoints = [
      fixedPoint({
        id: "top-appliance-fridge",
        symbol: "fridge",
        positionRatio: 0.1,
        widthSixteenths: 36 * 16
      })
    ];
    return wall;
  }

  const FRIDGE_WIDTH = 36 * 16;
  const PANEL_WIDTH = CABINET_STANDARDS.finishedPanel.sideWidthSixteenths;

  test("defaults to an empty gap above the fridge and no side panels", () => {
    const filled = autofillRound2Model(modelWithWall(fridgeWall()));
    const wall = filled.walls[0];
    const fridge = baseTier(wall).find(
      (segment) => segment.sourceFixedPointId === "top-appliance-fridge"
    );

    expect(fridge?.kind).toBe("appliance");
    expect(fridge?.widthSixteenths).toBe(FRIDGE_WIDTH);
    expect(wall.segments.some((segment) => segment.kind === "panel")).toBe(false);
    expectTiersClosed(filled);
  });

  test("wallCabinet intent puts an upper cabinet directly above the fridge", () => {
    const filled = autofillRound2Model(
      modelWithWall(fridgeWall()),
      {},
      intentWith({ "fridge.top-appliance-fridge.above": "wallCabinet" })
    );
    const uppers = upperTier(filled.walls[0]);
    const above = uppers.find(
      (segment) => segment.sourceFixedPointId === "top-appliance-fridge"
    );

    expect(above?.kind).toBe("cabinet");
    expect(above?.cabinetKind).toBe("upper");
    expect(above?.widthSixteenths).toBe(FRIDGE_WIDTH);
    expectTiersClosed(filled);
  });

  test("panel intent closes the space above the fridge with a finished panel", () => {
    const filled = autofillRound2Model(
      modelWithWall(fridgeWall()),
      {},
      intentWith({ "fridge.top-appliance-fridge.above": "panel" })
    );
    const uppers = upperTier(filled.walls[0]);
    const above = uppers.find(
      (segment) => segment.sourceFixedPointId === "top-appliance-fridge"
    );

    expect(above?.kind).toBe("panel");
    expect(above?.widthSixteenths).toBe(FRIDGE_WIDTH);
    expectTiersClosed(filled);
  });

  test("both-sides intent flanks the fridge with full-width finished panels", () => {
    const filled = autofillRound2Model(
      modelWithWall(fridgeWall()),
      {},
      intentWith({ "fridge.top-appliance-fridge.sides": "both" })
    );
    const base = baseTier(filled.walls[0]);
    const panels = base.filter((segment) => segment.kind === "panel");
    const fridge = base.find(
      (segment) =>
        segment.kind === "appliance" &&
        segment.sourceFixedPointId === "top-appliance-fridge"
    );

    expect(panels).toHaveLength(2);
    expect(panels.every((panel) => panel.widthSixteenths === PANEL_WIDTH)).toBe(
      true
    );
    expect(panels.every((panel) => panel.tier === "base")).toBe(true);
    // The appliance keeps its own width; the panels consume additional run.
    expect(fridge?.widthSixteenths).toBe(FRIDGE_WIDTH);
    expectTiersClosed(filled);
  });

  test("left-only intent adds a single finished panel on the start side", () => {
    const filled = autofillRound2Model(
      modelWithWall(fridgeWall()),
      {},
      intentWith({ "fridge.top-appliance-fridge.sides": "left" })
    );
    const base = baseTier(filled.walls[0]);
    const fridgeIndex = base.findIndex(
      (segment) =>
        segment.kind === "appliance" &&
        segment.sourceFixedPointId === "top-appliance-fridge"
    );
    const panels = base.filter((segment) => segment.kind === "panel");

    expect(panels).toHaveLength(1);
    // The panel sits immediately before the fridge (start side).
    expect(base[fridgeIndex - 1]?.kind).toBe("panel");
    expectTiersClosed(filled);
  });
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

function upperTier(wall: Round2Wall): WallSegment[] {
  return wall.segments.filter((segment) => segment.tier === "upper");
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
