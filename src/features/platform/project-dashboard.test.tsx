import { readFileSync } from "fs";
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
  name: "Amy Chen",
  role: "SALES" as const,
  disabledAt: null,
  monthlyRenderQuota: 50
};

const adminUser = {
  id: "u2",
  companyId: "c1",
  account: "admin" as const,
  email: "a@example.com",
  name: "Admin",
  role: "ADMIN" as const,
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
  createdByName: "Amy Chen",
  createdByRole: "SALES" as const,
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
    // The account menu (sign out) and primary navigation live in the global
    // sidebar (StudioRail), not in the dashboard itself — covered by
    // studio-shell.test. The handoff Projects screen renders glass row-cards
    // (not a <table>) with uppercase column labels.
    expect(html).toContain("Search customer, address or project");
    expect(html).toContain("New project");
    expect(html).toContain("Chen Family");
    expect(html).toContain("Main Kitchen");
    expect(html).toContain("CUSTOMER / PROJECT");
    expect(html).toContain("UPDATED");

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

  test("renders real project counts and Studio status semantics", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={adminUser}
        projects={[
          projectFixture,
          {
            ...projectFixture,
            id: "p2",
            projectName: "Lake House",
            status: "RENDERING_READY"
          }
        ]}
      />
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Projects");
    expect(html).toContain("ACTIVE");
    expect(html).toContain("INTAKE");
    expect(html).toContain("CONCEPT READY");
    expect(html).toContain("TOTAL");
    expect(html).toContain('data-project-status="INTAKE"');
    expect(html).toContain('data-project-status="RENDERING_READY"');
  });

  test("shows admins which sales rep each project belongs to", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard user={adminUser} projects={[projectFixture]} />
    );

    expect(html).toContain("<span>SALES</span>");
    expect(html).toContain("data-project-sales");
    expect(html).toContain("Amy Chen");
  });

  test("owners see the same project ownership column as admins", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={{ ...adminUser, role: "OWNER" }}
        projects={[projectFixture]}
      />
    );

    expect(html).toContain("data-project-sales");
    expect(html).toContain("Amy Chen");
  });

  test("labels the creator's role when the project was not created by sales", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={adminUser}
        projects={[
          {
            ...projectFixture,
            createdByUserId: "u2",
            createdByName: "Admin",
            createdByRole: "ADMIN" as const
          }
        ]}
      />
    );

    expect(html).toContain("ADMIN");
  });

  test("falls back to a dash when the creating user is gone", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard
        user={adminUser}
        projects={[
          { ...projectFixture, createdByName: null, createdByRole: null }
        ]}
      />
    );

    expect(html).toContain("data-project-sales");
    expect(html).not.toContain("Amy Chen");
  });

  test("hides the ownership column from sales users, who only see their own", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard user={salesUser} projects={[projectFixture]} />
    );

    expect(html).not.toContain("data-project-sales");
    expect(html).not.toContain("<span>SALES</span>");
  });

  test("uses the shared destructive action instead of the expanding Uiverse control", () => {
    const source = readFileSync(
      "src/features/platform/project-dashboard.tsx",
      "utf8"
    );

    expect(source).not.toContain("UiverseDeleteButton");
    expect(source).toContain('variant="destructive"');
  });
});
