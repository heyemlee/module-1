import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { NewProjectForm } from "./new-project-form";

describe("NewProjectForm", () => {
  test("renders required customer and project fields", () => {
    const html = renderToStaticMarkup(<NewProjectForm />);
    expect(html).toContain("Customer name");
    expect(html).toContain("Project name");
    expect(html).toContain("Create project");
  });
});
