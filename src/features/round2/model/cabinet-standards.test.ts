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
    expect(CABINET_STANDARDS.upper).toEqual({
      standardHeightsSixteenths: [30, 36, 40].map((value) => value * 16),
      hoodHeightsSixteenths: [12, 15, 18, 21, 24].map(
        (value) => value * 16
      ),
      refrigeratorHeightsSixteenths: [12, 15, 18].map(
        (value) => value * 16
      )
    });
    expect(CABINET_STANDARDS.vertical).toEqual({
      counterHeightSixteenths: 34 * 16 + 8,
      backsplashMinSixteenths: 18 * 16,
      flatMoulding: {
        minSixteenths: 2 * 16,
        preferredSixteenths: 3 * 16,
        maxSixteenths: 3 * 16
      }
    });
    expect(CABINET_STANDARDS.filler).toEqual({
      minSixteenths: 8,
      preferredSixteenths: 3 * 16
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
        modelNominalWidthSixteenths: 36 * 16,
        cabinetEnvelopeWidthSixteenths: 39 * 16,
        heightSixteenths: 34 * 16 + 8,
        depthSixteenths: 24 * 16
      },
      blindBase: {
        cabinetEnvelopeWidthSixteenths: 39 * 16,
        heightSixteenths: 34 * 16 + 8,
        depthSixteenths: 24 * 16,
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

  test("rejects a lazy-Susan envelope narrower than its nominal model", () => {
    expect(() =>
      cabinetStandardsSchema.parse({
        ...CABINET_STANDARDS,
        corner: {
          ...CABINET_STANDARDS.corner,
          lazySusan: {
            ...CABINET_STANDARDS.corner.lazySusan,
            cabinetEnvelopeWidthSixteenths: 33 * 16
          }
        }
      })
    ).toThrow("Lazy Susan envelope must cover its nominal model width");
  });
});
