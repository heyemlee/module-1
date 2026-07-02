import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round2VisualPrototype } from "./round2-visual-prototype";

describe("Round2VisualPrototype", () => {
  test("renders the approved three-task workflow", () => {
    const html = renderToStaticMarkup(
      <Round2VisualPrototype
        projectId="p1"
        projectName="Main Kitchen"
        customerName="Mike"
        actualRole="DESIGNER"
      />
    );

    expect(html).toContain("Field Measurement");
    expect(html).toContain("Design Proposal");
    expect(html).toContain("Drawings &amp; Review");
    expect(html).toContain("MEASUREMENT v3");
    expect(html).toContain("VISUAL PROTOTYPE");
    expect(html).toContain("View as Sales");
  });
});
