import { describe, expect, test } from "vitest";
import { mapCompanyUserRow, isAssignableRole } from "./user-admin-repository";

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
});
