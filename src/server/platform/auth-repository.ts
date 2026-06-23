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
};

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    companyId: row.company_id,
    account: row.account,
    email: row.email,
    name: row.name,
    role: row.role,
    disabledAt: row.disabled_at?.toISOString() ?? null
  };
}

export async function findUserForLogin(account: string) {
  const result = await query<UserRow>(
    `SELECT id, company_id, account, email, name, password_hash, role, disabled_at
     FROM users WHERE lower(account) = lower($1) LIMIT 1`,
    [account]
  );
  const row = result.rows[0];
  return row ? { user: mapUser(row), passwordHash: row.password_hash } : null;
}

export async function getUserBySession(sessionId: string) {
  const result = await query<UserRow>(
    `SELECT users.id, users.company_id, users.account, users.email, users.name, users.password_hash, users.role, users.disabled_at
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = $1 AND sessions.expires_at > now()
     LIMIT 1`,
    [sessionId]
  );
  const row = result.rows[0];
  return row ? mapUser(row) : null;
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
  await query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}
