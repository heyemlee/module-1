import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import { buildRound1Snapshot } from "./snapshot";
import { ShowroomIntakeApp } from "./showroom-intake-app";
import { AppliancesStep, OpeningsStep } from "./showroom-intake-steps";
import {
  CabinetFillSummaryPanel,
  Round1SnapshotPanel
} from "./showroom-intake-panels";

function buildFixtureSnapshot() {
  const form = createDefaultShowroomForm();
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildRound1Snapshot({
    showroomForm: form,
    normalized: result.normalized,
    positionOverrides: {},
    preliminaryCabinets: estimate,
    confirmationItems: [
      ...result.confirmationItems,
      ...estimate.confirmationItems
    ],
    readiness: result.readiness,
    now: () => new Date("2026-06-17T12:00:00.000Z")
  });
}

describe("OpeningsStep", () => {
  test("does not render first-phase door or window width inputs", () => {
    const html = renderToStaticMarkup(
      <OpeningsStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).not.toContain("Door width if known");
    expect(html).not.toContain("Window width if known");
  });
});

describe("AppliancesStep", () => {
  test("does not render appliance rough-position dropdowns", () => {
    const html = renderToStaticMarkup(
      <AppliancesStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).not.toContain("Sink position");
    expect(html).not.toContain("Range / cooktop position");
    expect(html).not.toContain("Fridge position");
    expect(html).not.toContain("Dishwasher position");
  });

  test("renders oven and microwave questions with core appliances", () => {
    const html = renderToStaticMarkup(
      <AppliancesStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).toContain("Oven / microwave");
    expect(html).toContain("Oven / microwave position");
  });
});

describe("ShowroomIntakeApp", () => {
  test("does not expose the internal layout prompt in the Round 1 workflow", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).not.toContain("Layout Prompt");
    expect(html).not.toContain("Leave the interior empty");
  });

  test("does not render an empty cabinet choices step in Round 1", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).not.toContain("Cabinets 6");
    expect(html).not.toContain("6. Layout-Sensitive Cabinet Choices");
    expect(html).not.toContain("Detailed cabinet choices are reserved for the next round.");
  });
});

describe("CabinetFillSummaryPanel", () => {
  test("does not show cabinet-fill metrics until cabinet generation runs after fixed positions are confirmed", () => {
    const html = renderToStaticMarkup(
      <CabinetFillSummaryPanel
        positionsConfirmed={true}
        cabinetFillGenerated={false}
        summary={{
          totalCabinets: 8,
          baseCabinets: { count: 4, linearFeet: 10 },
          wallCabinets: { count: 3, linearFeet: 8 },
          tallCabinets: { count: 1, linearFeet: 3 },
          estimatedFillerWidth: 2,
          salesEstimateOnly: true,
          notForProduction: true
        }}
      />
    );

    expect(html).toContain("Fixed positions confirmed");
    expect(html).toContain("Generate cabinet fill when the fixed positions are ready.");
    expect(html).not.toContain("Base");
    expect(html).not.toContain("Wall");
    expect(html).not.toContain("Tall");
    expect(html).not.toContain("Pricing reserved");
  });

  test("shows a rough cabinet-fill summary without detailed cabinet editing or pricing", () => {
    const html = renderToStaticMarkup(
      <CabinetFillSummaryPanel
        positionsConfirmed={true}
        cabinetFillGenerated={true}
        summary={{
          totalCabinets: 8,
          baseCabinets: { count: 4, linearFeet: 10 },
          wallCabinets: { count: 3, linearFeet: 8 },
          tallCabinets: { count: 1, linearFeet: 3 },
          estimatedFillerWidth: 2,
          salesEstimateOnly: true,
          notForProduction: true
        }}
      />
    );

    expect(html).toContain("Rough cabinet fill");
    expect(html).toContain("Pricing reserved");
    expect(html).not.toContain("Advanced manual cabinet review");
    expect(html).not.toContain("Add Cabinet");
    expect(html).not.toContain("Remove");
    expect(html).not.toContain("sales estimate");
  });
});

describe("Round1SnapshotPanel", () => {
  test("gates the rendering action and hides the JSON until a snapshot exists", () => {
    const html = renderToStaticMarkup(<Round1SnapshotPanel snapshot={null} />);

    expect(html).toContain("No snapshot yet");
    expect(html).toContain("Generate Rendering");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Snapshot ready");
    expect(html).not.toContain("View snapshot JSON");
  });

  test("shows snapshot status, sales-only flags and the snapshot JSON once generated", () => {
    const html = renderToStaticMarkup(
      <Round1SnapshotPanel snapshot={buildFixtureSnapshot()} />
    );

    expect(html).toContain("Snapshot ready");
    expect(html).toContain("Not production");
    expect(html).toContain("ROUGH");
    expect(html).toContain("Sales estimate only");
    expect(html).toContain("View snapshot JSON");
    expect(html).toContain("cabinetFillGenerated");
    expect(html).toContain("schemaVersion");
  });
});

describe("ShowroomIntakeApp snapshot gating", () => {
  test("starts with no snapshot before cabinet fill is generated", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).toContain("No snapshot yet");
    expect(html).not.toContain("Snapshot ready");
    expect(html).not.toContain("View snapshot JSON");
  });
});
