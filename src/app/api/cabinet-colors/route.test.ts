import { describe, expect, test, vi } from "vitest";

const requireUserMock = vi.hoisted(() => vi.fn());
const listCabinetColorsMock = vi.hoisted(() => vi.fn());
const authErrors = vi.hoisted(() => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {}
}));

vi.mock("@/server/platform/auth-service", () => ({
  requireUser: requireUserMock,
  UnauthorizedError: authErrors.UnauthorizedError,
  ForbiddenError: authErrors.ForbiddenError
}));

vi.mock("@/server/platform/cabinet-color-repository", () => ({
  listCabinetColors: listCabinetColorsMock
}));

import { GET } from "./route";

describe("sales cabinet color route", () => {
  test("returns active colors without hover example image payloads", async () => {
    requireUserMock.mockResolvedValue({ companyId: "company-1" });
    listCabinetColorsMock.mockResolvedValue([]);

    await GET();

    expect(listCabinetColorsMock).toHaveBeenCalledWith("company-1", true, {
      includeHoverExampleImages: false
    });
  });
});
