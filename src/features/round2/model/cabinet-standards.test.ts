import { describe, expect, test } from "vitest";
import {
  CABINET_STANDARDS,
  cabinetStandardsSchema
} from "./cabinet-standards";

describe("Round 2 cabinet standards", () => {
  test("validates the checked-in standards table", () => {
    expect(cabinetStandardsSchema.parse(CABINET_STANDARDS)).toEqual(
      CABINET_STANDARDS
    );
  });

  test("defines the approved cabinet dimensions in sixteenths", () => {
    expect(CABINET_STANDARDS.base.widthsSixteenths).toEqual(
      [9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((value) => value * 16)
    );
    expect(CABINET_STANDARDS.base.doorRule).toEqual({
      singleDoorMaxSixteenths: 21 * 16,
      doubleDoorMinSixteenths: 24 * 16
    });
    expect(CABINET_STANDARDS.base.drawerStacksSixteenths).toEqual([
      [6, 12, 12].map((value) => value * 16),
      [6, 6, 9, 9].map((value) => value * 16)
    ]);
    expect(CABINET_STANDARDS.upper.heightsSixteenths).toEqual(
      [30, 36, 42].map((value) => value * 16)
    );
    expect(CABINET_STANDARDS.vertical).toEqual({
      counterHeightSixteenths: 34 * 16 + 8,
      backsplashMinSixteenths: 18 * 16,
      flatMouldingAllowanceSixteenths: 3 * 16
    });
    expect(CABINET_STANDARDS.filler).toEqual({
      minSixteenths: 8,
      preferredSixteenths: 3 * 16
    });
    expect(CABINET_STANDARDS.depths).toEqual({
      baseSixteenths: 24 * 16,
      upperSixteenths: 12 * 16,
      tallSixteenths: 24 * 16
    });
  });

  test("defines the approved corner and appliance standards", () => {
    expect(CABINET_STANDARDS.corner).toEqual({
      lazySusan: {
        wallASixteenths: 36 * 16,
        wallBSixteenths: 36 * 16
      },
      blindBase: {
        minCabinetWidthSixteenths: 39 * 16,
        adjacentWallPullSixteenths: 3 * 16
      }
    });
    expect(CABINET_STANDARDS.appliances).toEqual({
      dishwasher: { widthSixteenths: 24 * 16, label: "DW24" },
      range: { widthSixteenths: 30 * 16, label: "RNG30" },
      sinkBase: {
        widthOptionsSixteenths: [30, 33, 36].map((value) => value * 16),
        defaultWidthSixteenths: 36 * 16,
        labelPrefix: "SB"
      },
      refrigerator: { widthSixteenths: 36 * 16, label: "REF36" },
      fallbackWidthSixteenths: 30 * 16
    });
  });

  test("deeply freezes the standards table", () => {
    expect(Object.isFrozen(CABINET_STANDARDS)).toBe(true);
    expect(Object.isFrozen(CABINET_STANDARDS.base)).toBe(true);
    expect(Object.isFrozen(CABINET_STANDARDS.base.widthsSixteenths)).toBe(true);
    expect(Object.isFrozen(CABINET_STANDARDS.appliances.sinkBase)).toBe(true);
  });

  test("rejects unordered or duplicate option lists", () => {
    for (const widthsSixteenths of [
      [12 * 16, 9 * 16],
      [9 * 16, 9 * 16]
    ]) {
      expect(() =>
        cabinetStandardsSchema.parse({
          ...CABINET_STANDARDS,
          base: {
            ...CABINET_STANDARDS.base,
            widthsSixteenths
          }
        })
      ).toThrow("strictly ascending");
    }
  });

  test("rejects overlapping door thresholds", () => {
    expect(() =>
      cabinetStandardsSchema.parse({
        ...CABINET_STANDARDS,
        base: {
          ...CABINET_STANDARDS.base,
          doorRule: {
            singleDoorMaxSixteenths: 24 * 16,
            doubleDoorMinSixteenths: 21 * 16
          }
        }
      })
    ).toThrow("Door thresholds must not overlap");
  });

  test("requires the default sink width to be an allowed option", () => {
    expect(() =>
      cabinetStandardsSchema.parse({
        ...CABINET_STANDARDS,
        appliances: {
          ...CABINET_STANDARDS.appliances,
          sinkBase: {
            ...CABINET_STANDARDS.appliances.sinkBase,
            defaultWidthSixteenths: 27 * 16
          }
        }
      })
    ).toThrow("Default sink width must be an allowed option");
  });
});
