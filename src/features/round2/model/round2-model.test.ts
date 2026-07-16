import { describe, expect, test } from "vitest";
import {
  applyMeasurementsToModel,
  buildMeasurementFields,
  ceilingMeasurementKey,
  formatSixteenths,
  initializeMeasurements,
  measurementsComplete,
  openingOffsetMeasurementKey,
  openingWidthMeasurementKey,
  wallLengthMeasurementKey
} from "./round2-model";
import { deriveWallsFromRound1 } from "./derive-walls";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";

describe("Round 2 model helpers", () => {
  test("formats 1/16 inch integers for drawings and controls", () => {
    expect(formatSixteenths(480)).toBe("30″");
    expect(formatSixteenths(12)).toBe("3/4″");
    expect(formatSixteenths(2406)).toBe("150 3/8″");
    expect(formatSixteenths(-8)).toBe("-1/2″");
    expect(formatSixteenths(null)).toBe("待量");
  });

  test("builds dynamic measurement keys from derived walls and openings", () => {
    const model = deriveWallsFromRound1(ROUND1_REFERENCE_FIXTURE.floorPlan);
    const measurements = initializeMeasurements(model);
    const window = model.walls[0].fixedPoints.find(
      (point) => point.type === "window"
    );

    expect(buildMeasurementFields(model).map((field) => field.key)).toContain(
      ceilingMeasurementKey()
    );
    // The demo layout carries a real scale, so the fields open pre-filled from
    // the recovered wall lengths and opening geometry.
    expect(measurements[wallLengthMeasurementKey("A")]).toBe(
      model.walls[0].lengthSixteenths
    );
    expect(window).toBeDefined();
    expect(measurements[openingWidthMeasurementKey(window!.id)]).toBe(
      window!.widthSixteenths
    );
    expect(measurements[openingOffsetMeasurementKey(window!.id)]).toBe(
      window!.offsetSixteenths
    );
    expect(measurementsComplete(model, measurements)).toBe(true);

    // A layout with no real scale leaves the fields blank and incomplete.
    const blankModel = deriveWallsFromRound1({
      ...ROUND1_REFERENCE_FIXTURE.floorPlan,
      pxPerInch: null,
      ceilingHeightSixteenths: null
    });
    const blank = initializeMeasurements(blankModel);
    expect(blank[wallLengthMeasurementKey("A")]).toBeNull();
    expect(measurementsComplete(blankModel, blank)).toBe(false);

    const complete = Object.fromEntries(
      Object.keys(measurements).map((key) => [key, 480])
    );
    expect(measurementsComplete(model, complete)).toBe(true);
    expect(
      applyMeasurementsToModel(model, complete).walls[0].lengthSixteenths
    ).toBe(480);
  });
});
