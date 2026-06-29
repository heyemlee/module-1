import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round1WorkspaceShell } from "./round1-workspace-shell";

describe("Round1WorkspaceShell", () => {
  test("renders the workspace regions in order", () => {
    const html = renderToStaticMarkup(
      <Round1WorkspaceShell
        projectBar={<div>Project</div>}
        stepStrip={<div>Steps</div>}
        leftPanel={<div>Form</div>}
        canvas={<div>Canvas</div>}
      />
    );

    expect(html).toContain('data-workspace-region="bar"');
    expect(html).toContain('data-workspace-region="steps"');
    expect(html).toContain('data-workspace-region="form"');
    expect(html).toContain('data-workspace-region="canvas"');
    expect(html.indexOf("Steps")).toBeLessThan(html.indexOf("Form"));
    expect(html.indexOf("Form")).toBeLessThan(html.indexOf("Canvas"));
  });

  test("omits the form region on canvas-only steps", () => {
    const html = renderToStaticMarkup(
      <Round1WorkspaceShell
        projectBar={<div>Project</div>}
        stepStrip={<div>Steps</div>}
        canvas={<div>Canvas</div>}
      />
    );

    expect(html).not.toContain('data-workspace-region="form"');
    expect(html).toContain('data-workspace-region="canvas"');
  });
});
