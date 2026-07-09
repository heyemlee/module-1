import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ROUND1_REFERENCE_FIXTURE } from "./round2-fixtures";
import { Round2VisualPrototype } from "./round2-visual-prototype";

describe("Round2VisualPrototype", () => {
  test("gates the three-task workflow behind a locked design basis", () => {
    const html = renderToStaticMarkup(
      <Round2VisualPrototype
        projectId="p1"
        projectName="Main Kitchen"
        customerName="Mike"
        actualRole="DESIGNER"
        reference={null}
        basis={null}
        hasRenderings
      />
    );

    expect(html).toContain("No design basis locked");
    expect(html).toContain("Open proposal &amp; confirm");
    expect(html).toContain("/projects/p1/renderings");
    expect(html).toContain("DESIGN BASIS REQUIRED");
    expect(html).not.toContain("Field Measurement");
    expect(html).toContain("TECHNICAL DESIGN");
    expect(html).toContain("DRAFT AUTOSAVED LOCALLY");
    expect(html).not.toContain("CHANGES ARE NOT SAVED");
    expect(html).toContain("View as Sales");
  });

  test("points at the concept phase when there is nothing to confirm yet", () => {
    const html = renderToStaticMarkup(
      <Round2VisualPrototype
        projectId="p1"
        projectName="Main Kitchen"
        customerName="Mike"
        actualRole="SALES"
        reference={null}
        basis={null}
        hasRenderings={false}
      />
    );

    expect(html).toContain("Open concept phase");
    expect(html).toContain("/projects/p1/round1");
  });

  test("shows the basis version and a change-basis link once locked", () => {
    const html = renderToStaticMarkup(
      <Round2VisualPrototype
        projectId="p1"
        projectName="Main Kitchen"
        customerName="Mike"
        actualRole="DESIGNER"
        reference={ROUND1_REFERENCE_FIXTURE}
        basis={{ version: 2, lockedAt: "2026-07-08T10:00:00.000Z" }}
        hasRenderings
      />
    );

    expect(html).toContain("BASIS v2");
    expect(html).toContain("Change basis");
    expect(html).toContain("/projects/p1/renderings");
  });
});
