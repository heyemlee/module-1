import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { AdminUsersView, canManageUserStatus } from "./admin-users-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} })
}));

const users: CompanyUserSummary[] = [
  {
    id: "admin-1",
    email: "admin@example.com",
    account: "admin",
    name: "Admin User",
    role: "ADMIN",
    monthlyRenderQuota: 100,
    disabledAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    used: 12
  },
  {
    id: "sales-1",
    email: "sales@example.com",
    account: "sales",
    name: "Sales Rep",
    role: "SALES",
    monthlyRenderQuota: 50,
    disabledAt: "2026-06-20T00:00:00.000Z",
    createdAt: "2026-06-02T00:00:00.000Z",
    used: 8
  }
];

describe("AdminUsersView", () => {
  test("renders the handoff user-management table", () => {
    const html = renderToStaticMarkup(
      <AdminUsersView users={users} currentUserId="admin-1" currentUserRole="ADMIN" />
    );

    expect(html).toContain("ADMIN / USERS");
    expect(html).toContain("User management");
    expect(html).toContain("+ New user");
    expect(html).toContain("RENDER QUOTA");
    // role pill (title-cased) + status labels
    expect(html).toContain("Admin");
    expect(html).toContain("Active");
    expect(html).toContain("Disabled");
    // self row + retained features
    expect(html).toContain("You");
    expect(html).toContain("View usage");
    expect(html).toContain("12/100"); // usage bar label
    expect(html).not.toContain("#f5f5f7");
  });

  test("keeps self-management protection", () => {
    expect(canManageUserStatus("admin-1", "sales-1")).toBe(true);
    expect(canManageUserStatus("admin-1", "admin-1")).toBe(false);
  });
});
