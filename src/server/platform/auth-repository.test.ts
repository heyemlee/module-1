import { afterEach, describe, expect, test, vi } from "vitest";
import { query } from "@/server/db/client";
import {
  deleteSession,
  deleteSessionsForUser,
  findUserForLogin,
  getUserBySession,
  invalidateSessionCache
} from "./auth-repository";

vi.mock("@/server/db/client", () => ({
  query: vi.fn()
}));

afterEach(() => {
  vi.mocked(query).mockReset();
  vi.useRealTimers();
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

  test("login lookup excludes soft-deleted users, with both identifier branches parenthesised", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as never);

    const result = await findUserForLogin("test");

    // A soft-deleted account resolves to no row, so it can never mint a session.
    expect(result).toBeNull();
    const sql = vi.mocked(query).mock.calls[0][0] as string;
    expect(sql).toContain("deleted_at IS NULL");
    // The AND must apply to both identifier branches, not just the email one.
    expect(sql).toContain("(lower(account) = lower($1) OR lower(email) = lower($1))");
  });

  test("session resolution ignores sessions belonging to soft-deleted users", async () => {
    const sessionId = `session-deleted-${crypto.randomUUID()}`;
    // The deleted_at filter means the JOIN yields no row even though the session
    // row still exists, so a session minted before deletion stops resolving.
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as never);

    const user = await getUserBySession(sessionId);

    expect(user).toBeNull();
    expect(vi.mocked(query).mock.calls[0][0]).toContain("users.deleted_at IS NULL");
    invalidateSessionCache(sessionId);
  });

  test("reuses a resolved session user within the short TTL", async () => {
    const sessionId = `session-cache-${crypto.randomUUID()}`;
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          company_id: "company-1",
          account: "sales",
          email: "sales@example.com",
          name: "Sales User",
          password_hash: "hash",
          role: "SALES",
          disabled_at: null
        }
      ]
    } as never);

    const first = await getUserBySession(sessionId);
    const second = await getUserBySession(sessionId);

    expect(first).toEqual(second);
    expect(query).toHaveBeenCalledTimes(1);
    invalidateSessionCache(sessionId);
  });

  test("refreshes a cached session user after the TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T12:00:00.000Z"));
    const sessionId = `session-expiry-${crypto.randomUUID()}`;
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            company_id: "company-1",
            account: "sales",
            email: "sales@example.com",
            name: "Before",
            password_hash: "hash",
            role: "SALES",
            disabled_at: null
          }
        ]
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            company_id: "company-1",
            account: "sales",
            email: "sales@example.com",
            name: "After",
            password_hash: "hash",
            role: "SALES",
            disabled_at: null
          }
        ]
      } as never);

    expect((await getUserBySession(sessionId))?.name).toBe("Before");
    vi.advanceTimersByTime(30_001);
    expect((await getUserBySession(sessionId))?.name).toBe("After");
    expect(query).toHaveBeenCalledTimes(2);
    invalidateSessionCache(sessionId);
  });

  test("logout evicts the cached session immediately", async () => {
    const sessionId = `session-logout-${crypto.randomUUID()}`;
    const userRow = {
      id: "user-1",
      company_id: "company-1",
      account: "sales",
      email: "sales@example.com",
      name: "Sales User",
      password_hash: "hash",
      role: "SALES",
      disabled_at: null
    };
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [userRow] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [userRow] } as never);

    await getUserBySession(sessionId);
    await deleteSession(sessionId);
    await getUserBySession(sessionId);

    expect(query).toHaveBeenCalledTimes(3);
    expect(vi.mocked(query).mock.calls[1][0]).toContain("DELETE FROM sessions");
    invalidateSessionCache(sessionId);
  });

  test("deletes a user's sessions and immediately evicts only that user's cached sessions", async () => {
    const firstSessionId = `session-user-1-a-${crypto.randomUUID()}`;
    const secondSessionId = `session-user-1-b-${crypto.randomUUID()}`;
    const otherSessionId = `session-user-2-${crypto.randomUUID()}`;
    const userOneRow = {
      id: "user-1",
      company_id: "company-1",
      account: "sales-one",
      email: "sales-one@example.com",
      name: "Sales One",
      password_hash: "hash",
      role: "SALES",
      disabled_at: null
    };
    const userTwoRow = {
      ...userOneRow,
      id: "user-2",
      account: "sales-two",
      email: "sales-two@example.com",
      name: "Sales Two"
    };
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [userOneRow] } as never)
      .mockResolvedValueOnce({ rows: [userOneRow] } as never)
      .mockResolvedValueOnce({ rows: [userTwoRow] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [userOneRow] } as never)
      .mockResolvedValueOnce({ rows: [userOneRow] } as never);

    await getUserBySession(firstSessionId);
    await getUserBySession(secondSessionId);
    await getUserBySession(otherSessionId);
    await deleteSessionsForUser("user-1");
    await getUserBySession(firstSessionId);
    await getUserBySession(secondSessionId);
    await getUserBySession(otherSessionId);

    expect(query).toHaveBeenCalledTimes(6);
    expect(vi.mocked(query).mock.calls[3][0]).toContain("DELETE FROM sessions WHERE user_id = $1");
    expect(vi.mocked(query).mock.calls[3][1]).toEqual(["user-1"]);
    invalidateSessionCache(firstSessionId);
    invalidateSessionCache(secondSessionId);
    invalidateSessionCache(otherSessionId);
  });
});
