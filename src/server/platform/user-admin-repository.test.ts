import { afterEach, describe, expect, test, vi } from "vitest";
import { query } from "@/server/db/client";
import { hashPassword } from "./passwords";
import {
  createCompanyUser,
  mapCompanyUserRow,
  isAssignableRole
} from "./user-admin-repository";

vi.mock("@/server/db/client", () => ({
  query: vi.fn()
}));

vi.mock("./passwords", () => ({
  hashPassword: vi.fn()
}));

afterEach(() => {
  vi.mocked(query).mockReset();
  vi.mocked(hashPassword).mockReset();
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
});
