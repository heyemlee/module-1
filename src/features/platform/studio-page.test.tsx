import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  StudioEmptyState,
  StudioPage,
  StudioPageHeader,
  StudioStat
} from "./studio-page";

describe("Studio page primitives", () => {
  test("renders a labelled page with one primary action region", () => {
    const html = renderToStaticMarkup(
      <StudioPage>
        <StudioPageHeader
          title="Projects"
          description="Continue active work."
          action={<a href="/projects/new">New project</a>}
        />
      </StudioPage>
    );

    expect(html).toContain("<main");
    expect(html).toContain("<h1");
    expect(html).toContain("Projects");
    expect(html).toContain("Continue active work.");
    expect(html).toContain('data-page-action="true"');
  });

  test("renders stat and empty-state semantics", () => {
    const html = renderToStaticMarkup(
      <>
        <StudioStat label="Active" value="7" />
        <StudioEmptyState
          title="No projects yet"
          description="Create the first project."
          action={<a href="/projects/new">New project</a>}
        />
      </>
    );

    expect(html).toContain("Active");
    expect(html).toContain("7");
    expect(html).toContain('data-empty-state="true"');
  });
});
