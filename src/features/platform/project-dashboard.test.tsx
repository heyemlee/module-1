import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ProjectDashboard } from "./project-dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} })
}));

describe("ProjectDashboard", () => {
  test("renders project search and new project controls", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={{ id: "u1", companyId: "c1", account: "sales", email: "s@example.com", name: "Sales", role: "SALES", disabledAt: null }}
        projects={[
          {
            id: "p1",
            companyId: "c1",
            customerId: "cust1",
            customerName: "Chen Family",
            projectName: "Main Kitchen",
            status: "DRAFT",
            createdByUserId: "u1",
            assignedDesignerId: null,
            updatedAt: "2026-06-19T00:00:00.000Z"
          }
        ]}
      />
    );
    expect(html).toContain("Projects");
    expect(html).toContain("Search customer, address, or project");
    expect(html).toContain("New project");
    // Sign out moved into the account menu (a closed Radix dropdown), so assert
    // the account-menu trigger renders instead of the menu item itself.
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain("Chen Family");
    expect(html).toContain("<table");
    expect(html).toContain("Customer");
    expect(html).toContain("Project");
    expect(html).toContain("Status");
    expect(html).toContain("Updated");
  });

  test("does not show bulk delete selection controls to sales users", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={{ id: "u1", companyId: "c1", account: "sales", email: "s@example.com", name: "Sales", role: "SALES", disabledAt: null }}
        projects={[
          {
            id: "p1",
            companyId: "c1",
            customerId: "cust1",
            customerName: "Chen Family",
            projectName: "Main Kitchen",
            status: "DRAFT",
            createdByUserId: "u1",
            assignedDesignerId: null,
            updatedAt: "2026-06-19T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(html).not.toContain("Select all");
    expect(html).not.toContain("Select project Main Kitchen");
  });
});
