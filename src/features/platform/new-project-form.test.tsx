import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AuthUser } from "@/server/platform/types";
import { NewProjectForm } from "./new-project-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    back: () => {},
    refresh: () => {},
    replace: () => {}
  })
}));

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
    expect(html).toContain("CUSTOMER NAME");
    expect(html).toContain("PROJECT NAME");
    expect(html).toContain("open →"); // "Create & open →" (& is HTML-escaped)
  });

  test("renders the handoff create-project modal shell", () => {
    const html = renderToStaticMarkup(<NewProjectForm user={user} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain("NEW PROJECT");
    expect(html).toContain("Create a project");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("Project card preview");
  });

  test("marks required fields and keeps optional contact fields", () => {
    const html = renderToStaticMarkup(<NewProjectForm user={user} />);

    expect(html).toContain('required=""');
    expect(html).toContain("PHONE");
    expect(html).toContain("EMAIL");
    expect(html).toContain("ADDRESS");
  });
});
