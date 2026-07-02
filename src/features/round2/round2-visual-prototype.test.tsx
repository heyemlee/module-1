import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ROUND1_REFERENCE_FIXTURE } from "./round2-fixtures";
import { Round2VisualPrototype } from "./round2-visual-prototype";

describe("Round2VisualPrototype", () => {
  test("gates the three-task workflow behind a locked Round 1 reference", () => {
    const html = renderToStaticMarkup(
      <Round2VisualPrototype
        projectId="p1"
        projectName="Main Kitchen"
        customerName="Mike"
        actualRole="DESIGNER"
        reference={ROUND1_REFERENCE_FIXTURE}
      />
    );

    expect(html).toContain("Round 1 handoff");
    expect(html).toContain("Lock for Round 2");
    expect(html).not.toContain("Field Measurement");
    expect(html).toContain("VISUAL PROTOTYPE");
    expect(html).toContain("View as Sales");
  });
});
