import { describe, expect, test } from "vitest";
import { CABINET_STANDARDS } from "./cabinet-standards";
import type { Round2HeightProfile, WallSegment } from "./round2-model";
import {
  resolveSinkUpperHeights,
  sinkUpperHeightSixteenths
} from "./sink-upper";

const PROFILE: Round2HeightProfile = {
  counterSixteenths: 36 * 16,
  backsplashSixteenths: 18 * 16,
  upperHeightSixteenths: 36 * 16,
  mouldingSixteenths: 3 * 16
};

describe("sink upper module height", () => {
  test("raises the bottom to the preferred 24 inch counter clearance", () => {
    // 18″ backsplash + 36″ uppers = 54″ above the counter; a 24″ clearance
    // leaves a 30″ cabinet, top-aligned with the rest of the run.
    expect(sinkUpperHeightSixteenths(PROFILE)).toBe(30 * 16);

    const clearance =
      PROFILE.backsplashSixteenths +
      PROFILE.upperHeightSixteenths -
      sinkUpperHeightSixteenths(PROFILE);
    expect(clearance).toBeGreaterThanOrEqual(
      CABINET_STANDARDS.sinkUpper.clearanceMinSixteenths
    );
    expect(clearance).toBeLessThanOrEqual(
      CABINET_STANDARDS.sinkUpper.clearanceMaxSixteenths
    );
  });

  test("never exceeds the ordinary upper height on a deep backsplash", () => {
    const deep = { ...PROFILE, backsplashSixteenths: 30 * 16 };
    expect(sinkUpperHeightSixteenths(deep)).toBe(
      deep.upperHeightSixteenths
    );
  });

  test("resolves only upper cabinets reserved for a sink fixed point", () => {
    const segments: WallSegment[] = [
      {
        id: "a-upper-3-cabinet",
        wallId: "A",
        tier: "upper",
        kind: "cabinet",
        widthSixteenths: 36 * 16,
        label: "W36",
        sourceFixedPointId: "top-appliance-sink"
      },
      {
        id: "a-upper-1-cabinet",
        wallId: "A",
        tier: "upper",
        kind: "cabinet",
        widthSixteenths: 36 * 16,
        label: "W36"
      },
      {
        id: "a-base-2-appliance",
        wallId: "A",
        tier: "base",
        kind: "appliance",
        cabinetKind: "sink",
        widthSixteenths: 36 * 16,
        label: "SB36",
        sourceFixedPointId: "top-appliance-sink"
      }
    ];
    const heights = resolveSinkUpperHeights(
      segments,
      [
        {
          id: "top-appliance-sink",
          type: "appliance",
          symbol: "sink",
          label: "sink",
          sourceWall: "TOP",
          order: 0,
          positionRatio: 0.4
        }
      ],
      PROFILE
    );

    expect([...heights.keys()]).toEqual(["a-upper-3-cabinet"]);
    expect(heights.get("a-upper-3-cabinet")).toBe(30 * 16);
  });
});
