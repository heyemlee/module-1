import { beforeEach, describe, expect, test, vi } from "vitest";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  deleteProjectForUser: vi.fn()
}));

vi.mock("@/server/platform/auth-service", () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  requireUser: mocks.requireUser,
  requireRole: mocks.requireRole,
  UnauthorizedError: class UnauthorizedError extends Error {}
}));

vi.mock("@/server/platform/project-repository", () => ({
  deleteProjectForUser: mocks.deleteProjectForUser,
  getProjectForUser: vi.fn()
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

function deleteRequest() {
  return DELETE(new Request("http://localhost/api/projects/project-1"), {
    params: Promise.resolve({ projectId: "project-1" })
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(admin);
  mocks.deleteProjectForUser.mockResolvedValue(true);
});

describe("DELETE /api/projects/[projectId]", () => {
  test("requires an admin user", async () => {
    await deleteRequest();

    expect(mocks.requireRole).toHaveBeenCalledWith(admin, ["ADMIN", "OWNER"]);
  });

  test("deletes projects through the authenticated admin company boundary", async () => {
    const response = await deleteRequest();

    expect(response.status).toBe(200);
    expect(mocks.deleteProjectForUser).toHaveBeenCalledWith("project-1", admin);
  });
});
