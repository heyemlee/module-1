import { afterEach, describe, expect, test, vi } from "vitest";
import { query } from "@/server/db/client";
import {
  canAccessProject,
  deleteProjectForUser,
  projectListWhereClause
} from "./project-repository";
import type { AuthUser } from "./types";

vi.mock("@/server/db/client", () => ({
  query: vi.fn()
}));

const sales: AuthUser = {
  id: "sales-1",
  companyId: "company-1",
  account: "sales",
  email: "sales@example.com",
  name: "Sales",
  role: "SALES",
  disabledAt: null,
  monthlyRenderQuota: 50
};

afterEach(() => {
  vi.mocked(query).mockReset();
});

describe("project authorization helpers", () => {
  test("sales can access projects they created", () => {
    expect(canAccessProject(sales, { companyId: "company-1", createdByUserId: "sales-1" })).toBe(true);
  });

  test("sales cannot access another sales user's project", () => {
    expect(canAccessProject(sales, { companyId: "company-1", createdByUserId: "sales-2" })).toBe(false);
  });

  test("designer, admin, and owner can access all company projects", () => {
    expect(canAccessProject({ ...sales, role: "DESIGNER" }, { companyId: "company-1", createdByUserId: "sales-2" })).toBe(true);
    expect(canAccessProject({ ...sales, role: "ADMIN" }, { companyId: "company-1", createdByUserId: "sales-2" })).toBe(true);
    expect(canAccessProject({ ...sales, role: "OWNER" }, { companyId: "company-1", createdByUserId: "sales-2" })).toBe(true);
  });

  test("no role crosses company boundaries", () => {
    expect(canAccessProject({ ...sales, role: "ADMIN" }, { companyId: "company-2", createdByUserId: "sales-1" })).toBe(false);
  });

  test("builds sales list filtering by creator", () => {
    expect(projectListWhereClause(sales)).toEqual({
      text: "projects.company_id = $1 AND projects.created_by_user_id = $2",
      values: ["company-1", "sales-1"]
    });
  });

  test("deletes projects only inside the user's company boundary", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: "project-1" }] } as never);

    await expect(deleteProjectForUser("project-1", { ...sales, role: "ADMIN" })).resolves.toBe(true);

    expect(vi.mocked(query).mock.calls[0][0]).toContain("company_id = $2");
    expect(vi.mocked(query).mock.calls[0][0]).toContain("RETURNING id");
    expect(vi.mocked(query).mock.calls[0][1]).toEqual(["project-1", "company-1"]);
  });

  test("reports false when no project was deleted", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as never);

    await expect(deleteProjectForUser("missing-project", { ...sales, role: "ADMIN" })).resolves.toBe(false);
  });
});
