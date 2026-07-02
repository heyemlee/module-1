import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DrawingSheet } from "./drawing-sheet";

describe("Round 2 drawing sheets", () => {
  test("renders professional A1 annotations", () => {
    const html = renderToStaticMarkup(
      <DrawingSheet sheet="A1" measurementVersion={3} proposalVersion={2} />
    );

    expect(html).toContain("MEASUREMENT v3");
    expect(html).toContain("PROPOSAL v2");
    expect(html).toContain('data-drawing-layer="dimensions"');
    expect(html).toContain('data-drawing-layer="cabinet-numbers"');
    expect(html).toContain("#13");
  });

  test("renders elevation dimensions on A2", () => {
    const html = renderToStaticMarkup(
      <DrawingSheet sheet="A2" measurementVersion={3} proposalVersion={2} />
    );

    expect(html).toContain("WALL A ELEVATION");
    expect(html).toContain("95 13/16");
    expect(html).toContain("36");
    expect(html).toContain('data-drawing-layer="cabinet-boundaries"');
  });
});
