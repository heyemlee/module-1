import { afterEach, describe, expect, test, vi } from "vitest";

const loginWithPassword = vi.fn();
const setSessionCookie = vi.fn();

class UnauthorizedError extends Error {}

vi.mock("@/server/platform/auth-service", () => ({
  loginWithPassword,
  setSessionCookie,
  UnauthorizedError
}));

describe("POST /api/auth/login", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("logs in with a non-email account identifier", async () => {
    loginWithPassword.mockResolvedValue({ id: "session-1" });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ account: "sales-one", password: "correct-password" })
      })
    );

    expect(response.status).toBe(200);
    expect(loginWithPassword).toHaveBeenCalledWith("sales-one", "correct-password");
    expect(setSessionCookie).toHaveBeenCalledWith("session-1");
  });
});
