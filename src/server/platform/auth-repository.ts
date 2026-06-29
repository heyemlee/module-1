import { randomBytes } from "node:crypto";
import { query } from "@/server/db/client";
import type { AuthUser, SessionRecord, UserRole } from "./types";

type UserRow = {
  id: string;
  company_id: string;
  account: string;
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  disabled_at: Date | null;
  monthly_render_quota: number;
};

function mapUser(row: Omit<UserRow, "password_hash">): AuthUser {
  return {
    id: row.id,
    companyId: row.company_id,
    account: row.account,
    email: row.email,
    name: row.name,
    role: row.role,
    disabledAt: row.disabled_at?.toISOString() ?? null,
    monthlyRenderQuota: row.monthly_render_quota
  };
}

export async function findUserForLogin(identifier: string) {
  // deleted_at IS NULL: a soft-deleted account must not be able to log back in.
  // Deletion only sets deleted_at and clears existing sessions; without this
  // filter findUserForLogin would still resolve the row and mint a fresh session,
  // and the user would stay invisible in admin (listCompanyUsers excludes
  // deleted_at). The identifier predicates are parenthesised so the AND applies
  // to both branches — otherwise OR binds looser and a delete-by-account match
  // would slip through.
  const result = await query<UserRow>(
    `SELECT id, company_id, account, email, name, password_hash, role, disabled_at, monthly_render_quota
     FROM users
     WHERE (lower(account) = lower($1) OR lower(email) = lower($1))
       AND deleted_at IS NULL
     LIMIT 1`,
    [identifier]
  );
  const row = result.rows[0];
  return row ? { user: mapUser(row), passwordHash: row.password_hash } : null;
}

// Session → user is resolved on every page navigation (the auth guard). Against
// the remote DB that JOIN costs a full ~254ms round trip each time, so we cache
// the resolved user in-process for a short TTL. Repeated navigations within the
// window skip the DB entirely, which is what makes page switches feel instant.
// Trade-off: a role change or disable lands up to TTL_MS later; logout evicts
// immediately via deleteSession. Bounded so a flood of bad session ids can't
// grow it without limit.
//
// ponytail: this cache (and its eviction) is per-instance. On a single instance
// that's correct. If you scale horizontally, an admin disabling a user or
// downgrading a role only evicts the handling pod's cache — other pods keep
// serving the stale user for up to the TTL. Lower SESSION_CACHE_TTL_MS to
// shrink that window, or move the cache to a shared store (Redis) for instant
// cross-instance revocation.
const SESSION_CACHE_TTL_MS = Number(process.env.SESSION_CACHE_TTL_MS) || 30_000;
const SESSION_CACHE_MAX = 5_000;
const sessionUserCache = new Map<string, { user: AuthUser; expiresAtMs: number }>();

export function invalidateSessionCache(sessionId: string) {
  sessionUserCache.delete(sessionId);
}

export async function getUserBySession(sessionId: string) {
  const cached = sessionUserCache.get(sessionId);
  if (cached && cached.expiresAtMs > Date.now()) return cached.user;

  // No password_hash here: session resolution never needs it, so don't pull the
  // secret into memory on every page navigation. monthly_render_quota IS needed —
  // mapUser maps it into AuthUser for the rendering quota check.
  const result = await query<Omit<UserRow, "password_hash">>(
    `SELECT users.id, users.company_id, users.account, users.email, users.name, users.role, users.disabled_at, users.monthly_render_quota
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = $1 AND sessions.expires_at > now()
       AND users.deleted_at IS NULL
     LIMIT 1`,
    [sessionId]
  );
  const row = result.rows[0];
  if (!row) {
    sessionUserCache.delete(sessionId);
    return null;
  }
  const user = mapUser(row);
  if (sessionUserCache.size >= SESSION_CACHE_MAX) sessionUserCache.clear();
  sessionUserCache.set(sessionId, { user, expiresAtMs: Date.now() + SESSION_CACHE_TTL_MS });
  return user;
}

export async function createSession(userId: string): Promise<SessionRecord> {
  const id = randomBytes(32).toString("hex");
  const result = await query<{ id: string; user_id: string; expires_at: Date }>(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, now() + interval '14 days')
     RETURNING id, user_id, expires_at`,
    [id, userId]
  );
  const row = result.rows[0];
  return { id: row.id, userId: row.user_id, expiresAt: row.expires_at.toISOString() };
}

export async function deleteSession(sessionId: string) {
  invalidateSessionCache(sessionId);
  await query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}

export async function deleteSessionsForUser(userId: string) {
  for (const [sessionId, cached] of sessionUserCache) {
    if (cached.user.id === userId) {
      sessionUserCache.delete(sessionId);
    }
  }
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}
