import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import { createDefaultCabinetRuns, createDefaultShowroomForm } from "./showroom-intake-data";
import { LayoutPreview } from "./layout-preview";

describe("LayoutPreview", () => {
  function renderPreview({
    cabinets,
    previewStage
  }: {
    cabinets?: ReturnType<typeof generatePreliminaryCabinetList>["cabinets"];
    previewStage?: "room" | "openings" | "layout" | "appliances" | "adjust";
  } = {}) {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    return renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={cabinets ?? estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
        previewStage={previewStage}
      />
    );
  }

  test("room stage shows only the room shell", () => {
    const html = renderPreview({ previewStage: "room" });

    expect(html).not.toContain('data-opening-symbol="');
    expect(html).not.toContain('data-layout-guide="');
    expect(html).not.toContain('data-appliance-symbol="');
    expect(html).not.toContain('data-base-cabinet="');
    expect(html).not.toContain('data-wall-cabinet="');
  });

  test("openings stage shows door and window without appliances or cabinets", () => {
    const html = renderPreview({ previewStage: "openings" });

    expect(html).toContain('data-opening-symbol="window"');
    expect(html).toContain('data-opening-symbol="door"');
    expect(html).not.toContain('data-layout-guide="');
    expect(html).not.toContain('data-appliance-symbol="');
    expect(html).not.toContain('data-base-cabinet="');
  });

  test("layout stage shows layout guides without appliances or cabinets", () => {
    const html = renderPreview({ previewStage: "layout" });

    expect(html).toContain('data-opening-symbol="window"');
    expect(html).toContain('data-opening-symbol="door"');
    expect(html).toContain('data-layout-guide="wall"');
    expect(html).not.toContain('data-appliance-symbol="');
    expect(html).not.toContain('data-base-cabinet="');
  });

  test("appliances stage adds appliances but still hides cabinets", () => {
    const html = renderPreview({ previewStage: "appliances" });

    expect(html).toContain('data-opening-symbol="window"');
    expect(html).toContain('data-appliance-symbol="sink"');
    expect(html).not.toContain('data-base-cabinet="');
    expect(html).not.toContain('data-wall-cabinet="');
  });

  test("cabinet shapes render only when cabinet data is generated", () => {
    const html = renderPreview({ cabinets: [], previewStage: "adjust" });

    expect(html).toContain('data-appliance-symbol="sink"');
    expect(html).not.toContain('data-base-cabinet="');
    expect(html).not.toContain('data-wall-cabinet="');
  });

  test("accepts parent-owned position overrides and change handler props", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{ fridge: { wall: "TOP", position: 140 } }}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain("Round 1");
  });

  test("renders dishwasher as an integrated base-cabinet panel", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain('data-appliance-symbol="dishwasher"');
    expect(html).toContain('data-dishwasher-panel="true"');
  });

  test("referenceMode strips labels and chrome but keeps geometry", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        // Forced on by referenceMode even though this is false.
        showPositionObjects={false}
        referenceMode
      />
    );

    // No text labels.
    expect(html).not.toContain(">window<");
    expect(html).not.toContain(">door<");
    expect(html).not.toContain(">Island<");
    // No header chrome (the "Round 1" badge text only survives in the SVG
    // aria-label, which is not rasterized into the image).
    expect(html).not.toContain("Top-Down Layout Plan");
    expect(html).not.toContain("Show MEP");
    expect(html).not.toContain(">Print");
    // No hover/drag chrome (sky halo, grab-dots).
    expect(html).not.toContain('stroke="#0ea5e9"');
    expect(html).not.toContain('fill="#334155"');
    // Geometry retained: appliances drawn (forced on) and the SVG viewBox intact.
    expect(html).toContain('data-appliance-symbol="sink"');
    expect(html).toContain('viewBox="0 0 760 560"');
  });

  test("default render keeps the labels and chrome that referenceMode strips", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain(">window<");
    expect(html).toContain(">door<");
    expect(html).toContain('stroke="#0ea5e9"');
  });

  test("excludes microwave/oven combo label but shows wall oven label", () => {
    const form = createDefaultShowroomForm();
    form.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo = { status: "YES", relation: "RIGHT_SIDE" };
    form.layoutSensitiveCabinets.cookingAppliances.wallOven = { status: "YES", relation: "LEFT_SIDE" };
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).not.toContain("Microwave / oven combo");
    expect(html).toContain("Wall oven");
  });

  test("excludes stacked wall oven and microwave label", () => {
    const form = createDefaultShowroomForm();
    form.layoutSensitiveCabinets.ovenMicrowave = {
      configuration: "WALL_OVEN_MICROWAVE_STACK",
      relation: "UNKNOWN"
    };
    form.layoutSensitiveCabinets.cookingAppliances.wallOven = {
      status: "YES",
      relation: "UNKNOWN"
    };
    form.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo = {
      status: "YES",
      relation: "UNKNOWN"
    };
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain('data-appliance-symbol="oven"');
    expect(html).not.toContain("Wall oven + microwave stack");
  });
});
