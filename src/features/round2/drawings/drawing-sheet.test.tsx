import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  FloorPlan,
  Wall
} from "@/features/round1/floorplan/plan-geometry";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { autofillRound2Model } from "../model/autofill";
import { deriveWallsFromRound1 } from "../model/derive-walls";
import { initializeMeasurements } from "../model/round2-model";
import { CabinetSchedule } from "./cabinet-schedule";
import { DrawingSheet, drawingSheetsForModel } from "./drawing-sheet";

describe("Round 2 drawing sheets", () => {
  test("renders A1 from the proposal model", () => {
    const model = submittedModel();
    const firstBase = model.walls[0].segments.find(
      (segment) => segment.tier === "base" && segment.kind === "cabinet"
    )!;
    const html = renderToStaticMarkup(
      <DrawingSheet
        sheet={drawingSheetsForModel(model)[0]}
        model={model}
        measurementVersion={3}
        proposalVersion={2}
        customerName="Test7.1"
        projectName="Kitchen Remodel"
      />
    );

    expect(html).toContain("MEASUREMENT v3");
    expect(html).toContain("PROPOSAL v2");
    expect(html).toContain('data-drawing-layer="dimensions"');
    expect(html).toContain('data-drawing-layer="cabinet-numbers"');
    expect(html).toContain(firstBase.code);
    expect(html).toContain("TEST7.1 · KITCHEN REMODEL");
    expect(html).not.toContain("MIKE · MAIN KITCHEN");
  });

  test("renders wall elevation dimensions and matching cabinet ids", () => {
    const model = submittedModel();
    const sheet = drawingSheetsForModel(model).find((item) => item.id === "A2")!;
    const firstUpper = model.walls[0].segments.find(
      (segment) => segment.tier === "upper" && segment.kind === "cabinet"
    )!;
    const html = renderToStaticMarkup(
      <DrawingSheet
        sheet={sheet}
        model={model}
        measurementVersion={3}
        proposalVersion={2}
        customerName="Test7.1"
        projectName="Kitchen Remodel"
      />
    );

    expect(html).toContain("WALL A ELEVATION");
    expect(html).toContain("96″");
    expect(html).toContain(firstUpper.code);
    expect(html).toContain('data-drawing-layer="cabinet-boundaries"');
  });

  test("creates elevation sheets from actual wall count", () => {
    const galley = submittedModel(planFor("GALLEY", ["TOP", "BOTTOM"]));
    expect(drawingSheetsForModel(galley).map((sheet) => sheet.id)).toEqual([
      "A1",
      "A2",
      "A3",
      "S1"
    ]);
  });

  test("renders S1 schedule from model segments including fillers", () => {
    const model = submittedModel();
    const filler = model.walls[0].segments.find(
      (segment) => segment.kind === "filler"
    )!;
    const html = renderToStaticMarkup(
      <CabinetSchedule
        model={model}
        customerName="Test7.1"
        projectName="Kitchen Remodel"
        measurementVersion={3}
        proposalVersion={2}
      />
    );

    expect(html).toContain("S1 · CABINET SCHEDULE");
    expect(html).toContain("Test7.1");
    expect(html).toContain("PROPOSAL v2");
    expect(html).toContain(filler.code);
    expect(html).toContain("Filler panel / scribe");
    expect(html).not.toContain("Fixture proposal");
  });
});

function submittedModel(floorPlan: FloorPlan = ROUND1_REFERENCE_FIXTURE.floorPlan) {
  const model = deriveWallsFromRound1(floorPlan);
  const measurements = Object.fromEntries(
    Object.keys(initializeMeasurements(model)).map((key) => [
      key,
      key === "room.ceiling"
        ? 96 * 16
        : key.endsWith(".width")
          ? 36 * 16
          : key.endsWith(".offset")
            ? 24 * 16
            : 150 * 16
    ])
  );
  return autofillRound2Model(model, measurements);
}

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
