import { afterEach, describe, expect, test, vi } from "vitest";

// loginWithPassword is the security-critical path. We mock the repository and the
// password hasher so we can assert the *control flow* — especially that a missing
// or disabled account still runs a password verification (constant time), which
// is what defeats account-enumeration via response timing.
// Mocks live in vi.hoisted() because auth-service is imported statically below and
// the mock factories run before normal top-level consts would be initialized.
const mocks = vi.hoisted(() => ({
  findUserForLogin: vi.fn(),
  createSession: vi.fn(),
  verifyPassword: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("./auth-repository", () => ({
  findUserForLogin: mocks.findUserForLogin,
  createSession: mocks.createSession,
  deleteSession: vi.fn(),
  getUserBySession: vi.fn()
}));
vi.mock("./passwords", () => ({ verifyPassword: mocks.verifyPassword }));

import { loginWithPassword, UnauthorizedError } from "./auth-service";

afterEach(() => vi.clearAllMocks());

describe("loginWithPassword", () => {
  test("unknown account: still runs verifyPassword (constant time), then rejects", async () => {
    mocks.findUserForLogin.mockResolvedValue(null);
    mocks.verifyPassword.mockResolvedValue(false);

    await expect(loginWithPassword("ghost", "pw")).rejects.toBeInstanceOf(UnauthorizedError);
    // The whole point of the dummy-hash branch: no early return for missing users.
    expect(mocks.verifyPassword).toHaveBeenCalledTimes(1);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  test("disabled account is rejected even with the correct password", async () => {
    mocks.findUserForLogin.mockResolvedValue({
      user: { id: "u1", disabledAt: "2026-01-01T00:00:00.000Z" },
      passwordHash: "stored"
    });
    mocks.verifyPassword.mockResolvedValue(true);

    await expect(loginWithPassword("u1", "right")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  test("wrong password is rejected", async () => {
    mocks.findUserForLogin.mockResolvedValue({
      user: { id: "u1", disabledAt: null },
      passwordHash: "stored"
    });
    mocks.verifyPassword.mockResolvedValue(false);

    await expect(loginWithPassword("u1", "wrong")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  test("valid credentials create a session", async () => {
    mocks.findUserForLogin.mockResolvedValue({
      user: { id: "u1", disabledAt: null },
      passwordHash: "stored"
    });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.createSession.mockResolvedValue({ id: "session-1", userId: "u1", expiresAt: "later" });

    const session = await loginWithPassword("u1", "right");

    expect(mocks.verifyPassword).toHaveBeenCalledWith("right", "stored");
    expect(mocks.createSession).toHaveBeenCalledWith("u1");
    expect(session).toEqual({ id: "session-1", userId: "u1", expiresAt: "later" });
  });
});
