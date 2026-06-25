import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { AdminUsersView, canManageUserStatus } from "./admin-users-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} })
}));

vi.mock("./create-user-form", () => ({
  CreateUserForm: () => <div data-testid="create-user-form">Create user</div>
}));

const users: CompanyUserSummary[] = [
  {
    id: "admin-1",
    email: "admin@example.com",
    account: "admin",
    name: "Admin",
    role: "ADMIN",
    monthlyRenderQuota: 100,
    disabledAt: null,
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "sales-1",
    email: "sales@example.com",
    account: "sales",
    name: "Sales",
    role: "SALES",
    monthlyRenderQuota: 50,
    disabledAt: "2026-06-20T00:00:00.000Z",
    createdAt: "2026-06-02T00:00:00.000Z"
  }
];

describe("AdminUsersView", () => {
  test("renders Studio page structure and real summary counts", () => {
    const html = renderToStaticMarkup(
      <AdminUsersView users={users} currentUserId="admin-1" />
    );

    expect(html).toContain(">Users<");
    expect(html).toContain("Manage access, roles, quotas, and usage.");
    expect(html).toContain(">1<");
    expect(html).toContain("Active");
    expect(html).toContain("Disabled");
    expect(html).toContain("Admins");
    expect(html).toContain("Create user");
    expect(html).toContain("You");
    expect(html).toContain("View usage");
    expect(html).not.toContain("#f5f5f7");
    expect(html).not.toContain("rounded-[18px]");
  });

  test("keeps self-management protection", () => {
    expect(canManageUserStatus("admin-1", "sales-1")).toBe(true);
    expect(canManageUserStatus("admin-1", "admin-1")).toBe(false);
  });
});
