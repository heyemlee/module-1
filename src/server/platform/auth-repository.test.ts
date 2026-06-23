import { afterEach, describe, expect, test, vi } from "vitest";
import { query } from "@/server/db/client";
import { findUserForLogin } from "./auth-repository";

vi.mock("@/server/db/client", () => ({
  query: vi.fn()
}));

afterEach(() => {
  vi.mocked(query).mockReset();
});

describe("auth repository", () => {
  test("finds login users by account or email identifier", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "admin-1",
          company_id: "company-1",
          account: "admin",
          email: "admin@example.com",
          name: "Admin",
          password_hash: "hash",
          role: "ADMIN",
          disabled_at: null
        }
      ]
    } as never);

    const result = await findUserForLogin("admin@example.com");

    expect(result?.user.email).toBe("admin@example.com");
    expect(vi.mocked(query).mock.calls[0][0]).toContain("lower(account) = lower($1)");
    expect(vi.mocked(query).mock.calls[0][0]).toContain("lower(email) = lower($1)");
    expect(vi.mocked(query).mock.calls[0][1]).toEqual(["admin@example.com"]);
  });
});
