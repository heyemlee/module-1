import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ProjectDashboard } from "./project-dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} })
}));

const salesUser = {
  id: "u1",
  companyId: "c1",
  account: "sales" as const,
  email: "s@example.com",
  name: "Sales",
  role: "SALES" as const,
  disabledAt: null,
  monthlyRenderQuota: 50
};

const projectFixture = {
  id: "p1",
  companyId: "c1",
  customerId: "cust1",
  customerName: "Chen Family",
  projectName: "Main Kitchen",
  status: "INTAKE" as const,
  createdByUserId: "u1",
  assignedDesignerId: null,
  updatedAt: "2026-06-19T00:00:00.000Z"
};

describe("ProjectDashboard", () => {
  test("renders project search, table, and creation controls", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={salesUser}
        projects={[projectFixture]}
      />
    );

    expect(html).toContain("Search customer, address, or project");
    expect(html).toContain("New project");
    expect(html).toContain("Chen Family");
    expect(html).toContain("<table");
    expect(html).toContain("Customer");
    expect(html).toContain("Project");
    expect(html).toContain("Status");
    expect(html).toContain("Updated");

    // Navigation and account actions belong to the authenticated layout.
    expect(html).not.toContain('aria-label="Primary navigation"');
  });

  test("does not show bulk delete selection controls to sales users", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={salesUser}
        projects={[projectFixture]}
      />
    );

    expect(html).not.toContain("Select all");
    expect(html).not.toContain("Select project Main Kitchen");
  });
});
