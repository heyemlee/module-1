import { cache } from "react";
import { cookies } from "next/headers";
import { createSession, deleteSession, findUserForLogin, getUserBySession } from "./auth-repository";
import { verifyPassword } from "./passwords";
import type { AuthUser, UserRole } from "./types";

export const SESSION_COOKIE = "abc_module_session";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function loginWithPassword(account: string, password: string) {
  const record = await findUserForLogin(account);
  if (!record || record.user.disabledAt) {
    throw new UnauthorizedError("Invalid account or password");
  }
  const ok = await verifyPassword(password, record.passwordHash);
  if (!ok) {
    throw new UnauthorizedError("Invalid account or password");
  }
  return createSession(record.user.id);
}

export async function setSessionCookie(sessionId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) await deleteSession(sessionId);
  jar.delete(SESSION_COOKIE);
}

// Deduped per request: a page and anything else in the same render tree that
// needs the current user share one resolution instead of repeating the lookup.
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  return sessionId ? getUserBySession(sessionId) : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user || user.disabledAt) throw new UnauthorizedError("Authentication required");
  return user;
}

export function requireRole(user: AuthUser, roles: UserRole[]) {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError("Insufficient permissions");
  }
}
