import { describe, expect, test } from "vitest";
import { resolveSegmentRole } from "./segment-role";
import type {
  Round2FixedPoint,
  Round2Wall,
  WallSegment
} from "./round2-model";

describe("resolveSegmentRole", () => {
  test("resolves base appliance roles from the fixed point symbol", () => {
    const wall = wallWith([
      appliancePoint("top-appliance-fridge", "fridge"),
      appliancePoint("top-appliance-dishwasher", "dishwasher"),
      appliancePoint("top-appliance-range", "range")
    ]);

    expect(
      resolveSegmentRole(
        applianceSegment("REF36", "top-appliance-fridge", "tall"),
        wall
      )
    ).toBe("fridge");
    expect(
      resolveSegmentRole(
        applianceSegment("DW24", "top-appliance-dishwasher"),
        wall
      )
    ).toBe("dishwasher");
    expect(
      resolveSegmentRole(applianceSegment("RNG30", "top-appliance-range"), wall)
    ).toBe("range");
  });

  test("the sink cabinetKind wins even without a fixed point", () => {
    const segment: WallSegment = {
      ...applianceSegment("SB36", undefined),
      cabinetKind: "sink"
    };
    expect(resolveSegmentRole(segment, wallWith([]))).toBe("sink");
  });

  test("falls back to the standards label prefix when the fixed point is gone", () => {
    const wall = wallWith([]);
    expect(resolveSegmentRole(applianceSegment("REF36", undefined), wall)).toBe(
      "fridge"
    );
    expect(resolveSegmentRole(applianceSegment("DW24", undefined), wall)).toBe(
      "dishwasher"
    );
  });

  test("upper projection resolves the hood but the fridge has no upper", () => {
    const wall = wallWith([
      appliancePoint("top-appliance-range", "range"),
      appliancePoint("top-appliance-fridge", "fridge")
    ]);

    expect(
      resolveSegmentRole(
        upperSegment("HD30", "top-appliance-range"),
        wall
      )
    ).toBe("hood");
    // The fridge is a single full-height unit; the upper tier leaves a gap
    // over it, so no cabinet segment carries a fridge-upper role.
    expect(
      resolveSegmentRole(
        upperSegment("W36", "top-appliance-fridge"),
        wall
      )
    ).toBeNull();
    expect(resolveSegmentRole(upperSegment("W30", undefined), wall)).toBeNull();
  });

  test("plain cabinets, fillers and openings have no role", () => {
    const wall = wallWith([]);
    const cabinet: WallSegment = {
      id: "a-base-1",
      wallId: "A",
      tier: "base",
      kind: "cabinet",
      widthSixteenths: 30 * 16,
      label: "B30",
      cabinetKind: "base"
    };
    expect(resolveSegmentRole(cabinet, wall)).toBeNull();
    expect(
      resolveSegmentRole({ ...cabinet, kind: "filler", label: "F3" }, wall)
    ).toBeNull();
    expect(
      resolveSegmentRole({ ...cabinet, kind: "opening", label: "Door" }, wall)
    ).toBeNull();
  });
});

function wallWith(
  fixedPoints: Round2FixedPoint[]
): Pick<Round2Wall, "fixedPoints"> {
  return { fixedPoints };
}

function appliancePoint(id: string, symbol: string): Round2FixedPoint {
  return {
    id,
    type: "appliance",
    label: symbol,
    sourceWall: "TOP",
    order: 0.5,
    positionRatio: 0.5,
    symbol
  };
}

function applianceSegment(
  label: string,
  sourceFixedPointId: string | undefined,
  cabinetKind?: WallSegment["cabinetKind"]
): WallSegment {
  return {
    id: `a-base-${label.toLowerCase()}`,
    wallId: "A",
    tier: "base",
    kind: "appliance",
    widthSixteenths: 30 * 16,
    label,
    cabinetKind,
    sourceFixedPointId
  };
}

function upperSegment(
  label: string,
  sourceFixedPointId: string | undefined
): WallSegment {
  return {
    id: `a-upper-${label.toLowerCase()}`,
    wallId: "A",
    tier: "upper",
    kind: "cabinet",
    widthSixteenths: 30 * 16,
    label,
    cabinetKind: "upper",
    sourceFixedPointId
  };
}
