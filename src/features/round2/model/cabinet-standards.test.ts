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
    expect(CABINET_STANDARDS.base).toEqual({
      widthsSixteenths: [9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(
        (value) => value * 16
      ),
      heightSixteenths: 34 * 16 + 8,
      doorRule: {
        singleDoorMaxSixteenths: 21 * 16,
        doubleDoorMinSixteenths: 24 * 16
      }
    });
    expect(CABINET_STANDARDS.upper).toEqual({
      standardHeightsSixteenths: [30, 36, 40, 42].map(
        (value) => value * 16
      ),
      hoodHeightsSixteenths: [12, 15, 18, 21, 24].map(
        (value) => value * 16
      ),
      refrigeratorHeightsSixteenths: [12, 15, 18, 21, 24].map(
        (value) => value * 16
      )
    });
    expect(CABINET_STANDARDS.vertical).toEqual({
      countertopThicknessSixteenths: 1 * 16 + 8,
      finishedCounterHeightSixteenths: 36 * 16,
      backsplashMinSixteenths: 18 * 16,
      flatMoulding: {
        minSixteenths: 2 * 16,
        preferredSixteenths: 3 * 16,
        maxSixteenths: 3 * 16
      }
    });
    expect(CABINET_STANDARDS.filler).toEqual({
      minSixteenths: 3 * 16,
      preferredSixteenths: 3 * 16,
      maxSixteenths: 6 * 16,
      commonWidthsSixteenths: [3, 4, 5, 6].map((value) => value * 16)
    });
    expect(CABINET_STANDARDS.depths).toEqual({
      baseSixteenths: 24 * 16,
      upperSixteenths: 12 * 16,
      refrigeratorUpperSixteenths: 24 * 16,
      tallSixteenths: 24 * 16
    });
  });

  test("defines the approved corner and appliance standards", () => {
    expect(CABINET_STANDARDS.corner).toEqual({
      lazySusan: {
        widthOptionsSixteenths: [33, 36].map((value) => value * 16),
        heightSixteenths: 34 * 16 + 8,
        depthSixteenths: 24 * 16
      },
      blindBase: {
        widthOptionsSixteenths: [39, 42, 45].map((value) => value * 16),
        heightSixteenths: 34 * 16 + 8,
        depthSixteenths: 24 * 16,
        adjacentWallPullSixteenths: 3 * 16
      },
      upperDiagonal: {
        widthOptionsSixteenths: [24 * 16]
      },
      upperBlind: {
        widthOptionsSixteenths: [27, 30].map((value) => value * 16),
        adjacentWallPullSixteenths: 3 * 16
      }
    });
    expect(CABINET_STANDARDS.appliances).toEqual({
      dishwasher: {
        widthOptionsSixteenths: [24 * 16],
        defaultWidthSixteenths: 24 * 16,
        labelPrefix: "DW",
        customerProvided: true
      },
      range: {
        widthOptionsSixteenths: [30, 33].map((value) => value * 16),
        defaultWidthSixteenths: 30 * 16,
        labelPrefix: "RNG",
        customerProvided: true
      },
      sinkBase: {
        widthOptionsSixteenths: [30, 33, 36, 39].map(
          (value) => value * 16
        ),
        defaultWidthSixteenths: 36 * 16,
        labelPrefix: "SB",
        customerProvided: true
      },
      refrigerator: {
        widthOptionsSixteenths: [36 * 16],
        defaultWidthSixteenths: 36 * 16,
        labelPrefix: "REF",
        customerProvided: true
      }
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

  test("requires each default appliance width to be an allowed option", () => {
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
    ).toThrow("Default appliance width must be an allowed option");
  });

  test("rejects an invalid flat-moulding range", () => {
    expect(() =>
      cabinetStandardsSchema.parse({
        ...CABINET_STANDARDS,
        vertical: {
          ...CABINET_STANDARDS.vertical,
          flatMoulding: {
            minSixteenths: 3 * 16,
            preferredSixteenths: 2 * 16,
            maxSixteenths: 3 * 16
          }
        }
      })
    ).toThrow("Flat moulding must satisfy min <= preferred <= max");
  });

  test("requires base height plus countertop to equal finished height", () => {
    expect(() =>
      cabinetStandardsSchema.parse({
        ...CABINET_STANDARDS,
        vertical: {
          ...CABINET_STANDARDS.vertical,
          finishedCounterHeightSixteenths: 35 * 16
        }
      })
    ).toThrow(
      "Base height plus countertop thickness must equal finished counter height"
    );
  });
});
