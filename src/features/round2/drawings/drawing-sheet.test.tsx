import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DrawingSheet } from "./drawing-sheet";

describe("Round 2 drawing sheets", () => {
  test("renders professional A1 annotations", () => {
    const html = renderToStaticMarkup(
      <DrawingSheet
        sheet="A1"
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
    expect(html).toContain("#13");
    expect(html).toContain("TEST7.1 · KITCHEN REMODEL");
    expect(html).not.toContain("MIKE · MAIN KITCHEN");
  });

  test("renders elevation dimensions on A2", () => {
    const html = renderToStaticMarkup(
      <DrawingSheet
        sheet="A2"
        measurementVersion={3}
        proposalVersion={2}
        customerName="Test7.1"
        projectName="Kitchen Remodel"
      />
    );

    expect(html).toContain("WALL A ELEVATION");
    expect(html).toContain("95 13/16");
    expect(html).toContain("36");
    expect(html).toContain('data-drawing-layer="cabinet-boundaries"');
  });
});
