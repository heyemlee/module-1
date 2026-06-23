import { describe, expect, test } from "vitest";
import { canManageUserStatus } from "./admin-users-view";

describe("AdminUsersView status actions", () => {
  test("allows status actions only for other users", () => {
    expect(canManageUserStatus("admin-1", "user-2")).toBe(true);
    expect(canManageUserStatus("admin-1", "admin-1")).toBe(false);
  });
});
