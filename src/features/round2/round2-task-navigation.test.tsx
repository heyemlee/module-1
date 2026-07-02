import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round2TaskNavigation } from "./round2-task-navigation";

describe("Round2TaskNavigation", () => {
  test("marks the current task and renders the approved workflow", () => {
    const html = renderToStaticMarkup(
      <Round2TaskNavigation task="PROPOSAL" onTaskChange={() => {}} />
    );

    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Field Measurement");
    expect(html).toContain("Design Proposal");
    expect(html).toContain("Drawings &amp; Review");
    expect(html).toContain("DESIGNER");
  });
});
