import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProjectDashboard } from "./project-dashboard";

describe("ProjectDashboard", () => {
  test("renders project search and new project controls", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={{ id: "u1", companyId: "c1", email: "s@example.com", name: "Sales", role: "SALES", disabledAt: null }}
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
    expect(html).toContain("New customer project");
    expect(html).toContain("Sign out");
    expect(html).toContain("Chen Family");
    expect(html).toContain("<table");
    expect(html).toContain("Customer");
    expect(html).toContain("Project");
    expect(html).toContain("Status");
    expect(html).toContain("Updated");
  });
});
