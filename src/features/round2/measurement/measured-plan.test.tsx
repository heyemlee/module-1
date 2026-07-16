import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  FloorPlan,
  Wall
} from "@/features/round1/floorplan/plan-geometry";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { deriveWallsFromRound1 } from "../model/derive-walls";
import {
  applyMeasurementsToModel,
  initializeMeasurements,
  openingOffsetMeasurementKey,
  openingWidthMeasurementKey,
  wallLengthMeasurementKey
} from "../model/round2-model";
import { MeasuredPlan } from "./measured-plan";

describe("MeasuredPlan", () => {
  test("renders derived U-shape walls with missing measurement placeholders", () => {
    // A plan drawn without real dimensions carries no scale, so the fields stay
    // blank and the plan shows the "待量" placeholders and dashed walls.
    const model = deriveWallsFromRound1({
      ...ROUND1_REFERENCE_FIXTURE.floorPlan,
      pxPerInch: null,
      ceilingHeightSixteenths: null
    });
    const html = renderToStaticMarkup(
      <MeasuredPlan
        model={model}
        measurements={initializeMeasurements(model)}
        selectedWall="A"
        selectedObjectId="wall-a"
        activeMeasurementKey={wallLengthMeasurementKey("A")}
        onSelectWall={() => {}}
        onSelectMeasurement={() => {}}
      />
    );

    expect(html).toContain('aria-label="Measured kitchen plan"');
    expect(html).toContain('data-wall="A"');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain("Wall A");
    expect(html).toContain("待量");
    expect(html).toContain("stroke-dasharray");
  });

  test("updates labels from measured dynamic values", () => {
    const model = deriveWallsFromRound1(ROUND1_REFERENCE_FIXTURE.floorPlan);
    const measurements = {
      ...initializeMeasurements(model),
      [wallLengthMeasurementKey("A")]: 150 * 16 + 6,
      [wallLengthMeasurementKey("B")]: 96 * 16,
      [wallLengthMeasurementKey("C")]: 132 * 16
    };
    for (const wall of model.walls) {
      for (const point of wall.fixedPoints) {
        if (point.type === "window" || point.type === "door") {
          measurements[openingWidthMeasurementKey(point.id)] = 36 * 16;
          measurements[openingOffsetMeasurementKey(point.id)] = 42 * 16;
        }
      }
    }
    measurements["room.ceiling"] = 96 * 16;
    const measured = applyMeasurementsToModel(model, measurements);

    const html = renderToStaticMarkup(
      <MeasuredPlan
        model={measured}
        measurements={measurements}
        selectedWall="A"
        selectedObjectId={null}
        activeMeasurementKey={null}
        onSelectWall={() => {}}
        onSelectMeasurement={() => {}}
      />
    );

    expect(html).toContain("150 3/8″");
    expect(html).toContain("WINDOW 36″");
    expect(html).not.toContain('data-wall="D"');
  });

  test("renders galley references as two opposing walls", () => {
    const model = deriveWallsFromRound1(planFor("GALLEY", ["TOP", "BOTTOM"]));
    const html = renderToStaticMarkup(
      <MeasuredPlan
        model={model}
        measurements={initializeMeasurements(model)}
        selectedWall="B"
        selectedObjectId={null}
        activeMeasurementKey={null}
        onSelectWall={() => {}}
        onSelectMeasurement={() => {}}
      />
    );

    expect(html).toContain('data-source-wall="TOP"');
    expect(html).toContain('data-source-wall="BOTTOM"');
    expect(html).not.toContain('data-wall="C"');
  });
});

function planFor(layoutPreference: string, walls: Wall[]): FloorPlan {
  return {
    ...ROUND1_REFERENCE_FIXTURE.floorPlan,
    layoutPreference,
    baseCabinets: walls.map((wall, index) => ({
      x: 100 + index * 40,
      y: 100,
      w: 40,
      h: 24,
      code: `B${index}`,
      confirmationRequired: false,
      wall
    })),
    wallCabinets: [],
    appliances: [],
    window: null,
    door: null,
    markers: []
  };
}
