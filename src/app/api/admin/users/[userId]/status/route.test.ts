import { beforeEach, describe, expect, test, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/server/platform/auth-service";
import { CompanyUserNotFoundError } from "@/server/platform/user-admin-repository";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  setCompanyUserDisabled: vi.fn()
}));

vi.mock("@/server/platform/auth-service", () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  requireRole: mocks.requireRole,
  requireUser: mocks.requireUser,
  UnauthorizedError: class UnauthorizedError extends Error {}
}));

vi.mock("@/server/platform/user-admin-repository", () => ({
  CompanyUserNotFoundError: class CompanyUserNotFoundError extends Error {},
  setCompanyUserDisabled: mocks.setCompanyUserDisabled
}));

const admin = {
  id: "admin-1",
  companyId: "company-1",
  account: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "ADMIN",
  disabledAt: null
};

function patchRequest(userId: string, body: unknown = { disabled: true }) {
  return PATCH(
    new Request(`http://localhost/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ userId }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(admin);
  mocks.setCompanyUserDisabled.mockResolvedValue({
    id: "user-2",
    account: "sales-two",
    email: "sales-two@users.internal",
    name: "sales-two",
    role: "SALES",
    disabledAt: "2026-06-23T22:00:00.000Z",
    createdAt: "2026-06-23T00:00:00.000Z"
  });
});

describe("PATCH /api/admin/users/[userId]/status", () => {
  test("lets an admin pause another user inside their company", async () => {
    const response = await patchRequest("user-2");

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith(admin, ["ADMIN"]);
    expect(mocks.setCompanyUserDisabled).toHaveBeenCalledWith({
      companyId: "company-1",
      userId: "user-2",
      disabled: true
    });
  });

  test("rejects attempts to change the current admin's own status", async () => {
    const response = await patchRequest("admin-1");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "You cannot change your own status" });
    expect(mocks.setCompanyUserDisabled).not.toHaveBeenCalled();
  });

  test("rejects malformed status requests", async () => {
    const response = await patchRequest("user-2", { disabled: "yes" });

    expect(response.status).toBe(400);
    expect(mocks.setCompanyUserDisabled).not.toHaveBeenCalled();
  });

  test("returns 404 when the target is missing or belongs to another company", async () => {
    mocks.setCompanyUserDisabled.mockRejectedValue(new CompanyUserNotFoundError("User not found"));

    const response = await patchRequest("outside-user");

    expect(response.status).toBe(404);
  });

  test("returns 401 when authentication is missing", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError("Authentication required"));

    const response = await patchRequest("user-2");

    expect(response.status).toBe(401);
  });

  test("returns 403 when the current user is not an admin", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new ForbiddenError("Insufficient permissions");
    });

    const response = await patchRequest("user-2");

    expect(response.status).toBe(403);
  });
});
