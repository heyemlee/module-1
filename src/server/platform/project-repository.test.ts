import { describe, expect, test } from "vitest";
import { canAccessProject, projectListWhereClause } from "./project-repository";
import type { AuthUser } from "./types";

const sales: AuthUser = {
  id: "sales-1",
  companyId: "company-1",
  email: "sales@example.com",
  name: "Sales",
  role: "SALES",
  disabledAt: null
};

describe("project authorization helpers", () => {
  test("sales can access projects they created", () => {
    expect(canAccessProject(sales, { companyId: "company-1", createdByUserId: "sales-1" })).toBe(true);
  });

  test("sales cannot access another sales user's project", () => {
    expect(canAccessProject(sales, { companyId: "company-1", createdByUserId: "sales-2" })).toBe(false);
  });

  test("designer and admin can access all company projects", () => {
    expect(canAccessProject({ ...sales, role: "DESIGNER" }, { companyId: "company-1", createdByUserId: "sales-2" })).toBe(true);
    expect(canAccessProject({ ...sales, role: "ADMIN" }, { companyId: "company-1", createdByUserId: "sales-2" })).toBe(true);
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
});
