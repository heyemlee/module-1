import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { autofillRound2Model } from "../model/autofill";
import { deriveWallsFromRound1 } from "../model/derive-walls";
import { initializeMeasurements } from "../model/round2-model";
import { DesignPlan } from "./design-plan";
import { WallElevation } from "./wall-elevation";

describe("Round 2 proposal selection", () => {
  test("marks the same model segment selected in plan and elevation", () => {
    const model = submittedModel();
    const selected = model.walls[0].segments.find(
      (segment) => segment.tier === "base"
    )!;

    const plan = renderToStaticMarkup(
      <DesignPlan
        model={model}
        selectedObjectId={selected.id}
        onSelect={() => {}}
      />
    );
    const elevation = renderToStaticMarkup(
      <WallElevation
        wallId={selected.wallId}
        model={model}
        selectedObjectId={selected.id}
        onSelect={() => {}}
      />
    );

    expect(plan).toContain(`data-segment-id="${selected.id}"`);
    expect(plan).toContain('data-selected="true"');
    expect(plan).not.toContain("OPEN SIDE");
    expect(elevation).toContain(`data-segment-id="${selected.id}"`);
    expect(elevation).toContain('data-selected="true"');
  });
});

function submittedModel() {
  const model = deriveWallsFromRound1(ROUND1_REFERENCE_FIXTURE.floorPlan);
  const measurements = Object.fromEntries(
    Object.keys(initializeMeasurements(model)).map((key) => [
      key,
      key === "room.ceiling"
        ? 96 * 16
        : key.endsWith(".width")
          ? 36 * 16
          : key.endsWith(".offset")
            ? 42 * 16
            : 150 * 16
    ])
  );
  return autofillRound2Model(model, measurements);
}
