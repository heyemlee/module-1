import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WorkspaceModeSwitch } from "./workspace-mode-switch";

describe("WorkspaceModeSwitch", () => {
  test("exposes both modes as an accessible radio group", () => {
    const html = renderToStaticMarkup(
      <WorkspaceModeSwitch mode="guided" onModeChange={() => {}} />
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Guided");
    expect(html).toContain("Canvas focus");
    expect(html).toContain('aria-checked="true"');
  });
});
