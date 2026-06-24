import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { AuthUser } from "@/server/platform/types";
import { NewProjectForm } from "./new-project-form";

const user: AuthUser = {
  id: "1",
  companyId: "co",
  account: "tester",
  email: "tester@example.com",
  name: "Tester",
  role: "SALES",
  disabledAt: null,
  monthlyRenderQuota: 50
};

describe("NewProjectForm", () => {
  test("renders required customer and project fields", () => {
    const html = renderToStaticMarkup(<NewProjectForm user={user} />);
    expect(html).toContain("Customer name");
    expect(html).toContain("Project name");
    expect(html).toContain("Create project");
  });
});
