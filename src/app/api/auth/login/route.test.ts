import { afterEach, describe, expect, test, vi } from "vitest";
import { __resetRateLimits } from "@/server/platform/rate-limit";

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
    __resetRateLimits();
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

  test("rate-limits after 10 attempts from the same IP (429 + Retry-After)", async () => {
    loginWithPassword.mockRejectedValue(new UnauthorizedError("nope"));
    const { POST } = await import("./route");
    const attempt = () =>
      POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "x-forwarded-for": "9.9.9.9" },
          body: JSON.stringify({ account: "a", password: "b" })
        })
      );

    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});
