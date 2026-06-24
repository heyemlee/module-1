import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round1WorkspaceShell } from "./round1-workspace-shell";

describe("Round1WorkspaceShell", () => {
  test("marks guided mode with the expanded workspace contract", () => {
    const html = renderToStaticMarkup(
      <Round1WorkspaceShell
        mode="guided"
        projectBar={<div>Project</div>}
        stepNavigation={<div>Steps</div>}
        canvas={<div>Canvas</div>}
        inspector={<div>Inspector</div>}
      />
    );

    expect(html).toContain('data-workspace-mode="guided"');
    expect(html).toContain('data-workspace-region="steps"');
    expect(html).toContain('data-workspace-region="canvas"');
    expect(html).toContain('data-workspace-region="inspector"');
  });

  test("marks canvas focus mode without changing region order", () => {
    const html = renderToStaticMarkup(
      <Round1WorkspaceShell
        mode="canvas"
        projectBar={<div>Project</div>}
        stepNavigation={<div>Steps</div>}
        canvas={<div>Canvas</div>}
        inspector={<div>Inspector</div>}
      />
    );

    expect(html).toContain('data-workspace-mode="canvas"');
    expect(html.indexOf("Steps")).toBeLessThan(html.indexOf("Canvas"));
    expect(html.indexOf("Canvas")).toBeLessThan(html.indexOf("Inspector"));
  });
});
