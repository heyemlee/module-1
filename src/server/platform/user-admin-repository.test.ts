import { afterEach, describe, expect, test, vi } from "vitest";
import { query } from "@/server/db/client";
import { hashPassword } from "./passwords";
import { deleteSessionsForUser } from "./auth-repository";
import {
  CompanyUserNotFoundError,
  createCompanyUser,
  mapCompanyUserRow,
  isAssignableRole,
  setCompanyUserDisabled
} from "./user-admin-repository";

vi.mock("@/server/db/client", () => ({
  query: vi.fn()
}));

vi.mock("./passwords", () => ({
  hashPassword: vi.fn()
}));

vi.mock("./auth-repository", () => ({
  deleteSessionsForUser: vi.fn()
}));

afterEach(() => {
  vi.mocked(query).mockReset();
  vi.mocked(hashPassword).mockReset();
  vi.mocked(deleteSessionsForUser).mockReset();
});

describe("user admin helpers", () => {
  test("maps a user row to a safe summary (no password hash)", () => {
    const user = mapCompanyUserRow({
      id: "u1",
      account: "sales-one",
      email: "sales@example.com",
      name: "Sales One",
      role: "SALES",
      disabled_at: null,
      created_at: new Date("2026-06-19T00:00:00.000Z")
    });
    expect(user).toEqual({
      id: "u1",
      account: "sales-one",
      email: "sales@example.com",
      name: "Sales One",
      role: "SALES",
      disabledAt: null,
      createdAt: "2026-06-19T00:00:00.000Z"
    });
    expect("passwordHash" in user).toBe(false);
  });

  test("only allows the three known roles", () => {
    expect(isAssignableRole("ADMIN")).toBe(true);
    expect(isAssignableRole("SALES")).toBe(true);
    expect(isAssignableRole("DESIGNER")).toBe(true);
    expect(isAssignableRole("OWNER")).toBe(false);
  });

  test("creates a user from account, role, and password only", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "u2",
            account: "sales-two",
            email: "sales-two@users.internal",
            name: "sales-two",
            role: "SALES",
            disabled_at: null,
            created_at: new Date("2026-06-23T00:00:00.000Z")
          }
        ]
      } as never);
    vi.mocked(hashPassword).mockResolvedValue("hashed-password");

    const created = await createCompanyUser({
      companyId: "company-1",
      account: "sales-two",
      role: "SALES",
      password: "password123"
    });

    expect(vi.mocked(query).mock.calls[1][1]).toEqual([
      "company-1",
      "sales-two",
      "sales-two@users.internal",
      "sales-two",
      "hashed-password",
      "SALES"
    ]);
    expect(created.account).toBe("sales-two");
  });

  test("pauses a company user and deletes their active sessions", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "user-2",
          account: "sales-two",
          email: "sales-two@users.internal",
          name: "sales-two",
          role: "SALES",
          disabled_at: new Date("2026-06-23T22:00:00.000Z"),
          created_at: new Date("2026-06-23T00:00:00.000Z")
        }
      ]
    } as never);

    const updated = await setCompanyUserDisabled({
      companyId: "company-1",
      userId: "user-2",
      disabled: true
    });

    expect(vi.mocked(query).mock.calls[0][0]).toContain("WHERE id = $1 AND company_id = $2");
    expect(vi.mocked(query).mock.calls[0][0]).toContain("CASE WHEN $3 THEN now() ELSE NULL END");
    expect(vi.mocked(query).mock.calls[0][1]).toEqual(["user-2", "company-1", true]);
    expect(deleteSessionsForUser).toHaveBeenCalledWith("user-2");
    expect(updated.disabledAt).toBe("2026-06-23T22:00:00.000Z");
  });

  test("activates a company user without creating or deleting sessions", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "user-2",
          account: "sales-two",
          email: "sales-two@users.internal",
          name: "sales-two",
          role: "SALES",
          disabled_at: null,
          created_at: new Date("2026-06-23T00:00:00.000Z")
        }
      ]
    } as never);

    const updated = await setCompanyUserDisabled({
      companyId: "company-1",
      userId: "user-2",
      disabled: false
    });

    expect(vi.mocked(query).mock.calls[0][1]).toEqual(["user-2", "company-1", false]);
    expect(deleteSessionsForUser).not.toHaveBeenCalled();
    expect(updated.disabledAt).toBeNull();
  });

  test("rejects status updates for users outside the company", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      setCompanyUserDisabled({
        companyId: "company-1",
        userId: "user-outside-company",
        disabled: true
      })
    ).rejects.toBeInstanceOf(CompanyUserNotFoundError);

    expect(deleteSessionsForUser).not.toHaveBeenCalled();
  });
});
