import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round2WorkspaceShell } from "./round2-workspace-shell";

describe("Round2WorkspaceShell", () => {
  test("orders header, tasks, and workspace", () => {
    const html = renderToStaticMarkup(
      <Round2WorkspaceShell
        projectBar={<div>Project bar</div>}
        taskBar={<div>Tasks</div>}
      >
        <div>Workspace</div>
      </Round2WorkspaceShell>
    );

    expect(html).toContain('data-round2-region="project"');
    expect(html).toContain('data-round2-region="tasks"');
    expect(html).toContain('data-round2-region="workspace"');
    expect(html.indexOf("Project bar")).toBeLessThan(html.indexOf("Tasks"));
    expect(html.indexOf("Tasks")).toBeLessThan(html.indexOf("Workspace"));
  });
});
