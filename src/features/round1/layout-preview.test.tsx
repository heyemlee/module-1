import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import { createDefaultCabinetRuns, createDefaultShowroomForm } from "./showroom-intake-data";
import { LayoutPreview } from "./layout-preview";

describe("LayoutPreview", () => {
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
});
