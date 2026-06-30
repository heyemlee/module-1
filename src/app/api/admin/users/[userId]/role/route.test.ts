import { beforeEach, describe, expect, test, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/server/platform/auth-service";
import { CompanyUserNotFoundError } from "@/server/platform/user-admin-repository";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  setCompanyUserRole: vi.fn()
}));

vi.mock("@/server/platform/auth-service", () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  requireRole: mocks.requireRole,
  requireUser: mocks.requireUser,
  UnauthorizedError: class UnauthorizedError extends Error {}
}));

vi.mock("@/server/platform/user-admin-repository", () => ({
  CompanyUserNotFoundError: class CompanyUserNotFoundError extends Error {},
  // Real implementation — the route validates the role string with it.
  isAssignableRole: (role: string) => ["ADMIN", "SALES", "DESIGNER"].includes(role),
  setCompanyUserRole: mocks.setCompanyUserRole
}));

const owner = {
  id: "owner-1",
  companyId: "company-1",
  account: "owner",
  email: "owner@example.com",
  name: "Owner",
  role: "OWNER",
  disabledAt: null
};

function patchRequest(userId: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ userId }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(owner);
  mocks.setCompanyUserRole.mockResolvedValue({
    id: "user-2",
    account: "kabi",
    email: "kabi@users.internal",
    name: "kabi",
    role: "SALES",
    disabledAt: null,
    createdAt: "2026-06-23T00:00:00.000Z"
  });
});

describe("PATCH /api/admin/users/[userId]/role", () => {
  test("lets an owner re-role another user with its full manageable set", async () => {
    const response = await patchRequest("user-2", { role: "SALES" });

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith(owner, ["ADMIN", "OWNER"]);
    expect(mocks.setCompanyUserRole).toHaveBeenCalledWith({
      companyId: "company-1",
      userId: "user-2",
      role: "SALES",
      manageableRoles: ["ADMIN", "SALES", "DESIGNER"]
    });
  });

  test("forbids an admin from granting ADMIN (no privilege escalation)", async () => {
    mocks.requireUser.mockResolvedValue({ ...owner, id: "admin-1", role: "ADMIN" });
    const response = await patchRequest("user-2", { role: "ADMIN" });

    expect(response.status).toBe(403);
    expect(mocks.setCompanyUserRole).not.toHaveBeenCalled();
  });

  test("lets an admin flip a managed user between SALES and DESIGNER", async () => {
    mocks.requireUser.mockResolvedValue({ ...owner, id: "admin-1", role: "ADMIN" });
    const response = await patchRequest("user-2", { role: "DESIGNER" });

    expect(response.status).toBe(200);
    expect(mocks.setCompanyUserRole).toHaveBeenCalledWith({
      companyId: "company-1",
      userId: "user-2",
      role: "DESIGNER",
      manageableRoles: ["SALES", "DESIGNER"]
    });
  });

  test("rejects changing your own role", async () => {
    const response = await patchRequest("owner-1", { role: "SALES" });

    expect(response.status).toBe(400);
    expect(mocks.setCompanyUserRole).not.toHaveBeenCalled();
  });

  test("rejects an unknown / non-assignable role (e.g. OWNER)", async () => {
    const response = await patchRequest("user-2", { role: "OWNER" });

    expect(response.status).toBe(400);
    expect(mocks.setCompanyUserRole).not.toHaveBeenCalled();
  });

  test("returns 404 when the target is missing or out of reach", async () => {
    mocks.setCompanyUserRole.mockRejectedValue(new CompanyUserNotFoundError("User not found"));
    const response = await patchRequest("outside-user", { role: "SALES" });

    expect(response.status).toBe(404);
  });

  test("returns 401 when authentication is missing", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError("Authentication required"));
    const response = await patchRequest("user-2", { role: "SALES" });

    expect(response.status).toBe(401);
  });

  test("returns 403 when the current user is not an admin", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new ForbiddenError("Insufficient permissions");
    });
    const response = await patchRequest("user-2", { role: "SALES" });

    expect(response.status).toBe(403);
  });
});
