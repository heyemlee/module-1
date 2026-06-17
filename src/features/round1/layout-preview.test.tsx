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
});
