import { query } from "@/server/db/client";
import { hashPassword } from "./passwords";
import { deleteSessionsForUser } from "./auth-repository";
import type { UserRole } from "./types";

export type CompanyUserSummary = {
  id: string;
  account: string;
  email: string;
  name: string;
  role: UserRole;
  disabledAt: string | null;
  createdAt: string;
};

type CompanyUserRow = {
  id: string;
  account: string;
  email: string;
  name: string;
  role: UserRole;
  disabled_at: Date | null;
  created_at: Date;
};

const ASSIGNABLE_ROLES: UserRole[] = ["ADMIN", "SALES", "DESIGNER"];

export function isAssignableRole(role: string): role is UserRole {
  return (ASSIGNABLE_ROLES as string[]).includes(role);
}

export function mapCompanyUserRow(row: CompanyUserRow): CompanyUserSummary {
  return {
    id: row.id,
    account: row.account,
    email: row.email,
    name: row.name,
    role: row.role,
    disabledAt: row.disabled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString()
  };
}

export async function listCompanyUsers(companyId: string) {
  const result = await query<CompanyUserRow>(
    `SELECT id, account, email, name, role, disabled_at, created_at
     FROM users
     WHERE company_id = $1
     ORDER BY created_at ASC`,
    [companyId]
  );
  return result.rows.map(mapCompanyUserRow);
}

export class AccountAlreadyExistsError extends Error {}
export class CompanyUserNotFoundError extends Error {}

export async function createCompanyUser(input: {
  companyId: string;
  account: string;
  role: UserRole;
  password: string;
}) {
  const accountResult = await query<{ id: string }>(
    `SELECT id FROM users WHERE lower(account) = lower($1) LIMIT 1`,
    [input.account]
  );
  if (accountResult.rows[0]) throw new AccountAlreadyExistsError("Account already in use");

  // Name and email remain required legacy columns, but account is now the only
  // user-facing identity field. Keep those columns internal and deterministic.
  const internalName = input.account;
  const internalEmail = `${input.account.toLowerCase()}@users.internal`;
  const passwordHash = await hashPassword(input.password);
  const result = await query<CompanyUserRow>(
    `INSERT INTO users (company_id, account, email, name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, account, email, name, role, disabled_at, created_at`,
    [input.companyId, input.account, internalEmail, internalName, passwordHash, input.role]
  );
  return mapCompanyUserRow(result.rows[0]);
}

export async function setCompanyUserDisabled(input: {
  companyId: string;
  userId: string;
  disabled: boolean;
}) {
  const result = await query<CompanyUserRow>(
    `UPDATE users
     SET disabled_at = CASE WHEN $3 THEN now() ELSE NULL END,
         updated_at = now()
     WHERE id = $1 AND company_id = $2
     RETURNING id, account, email, name, role, disabled_at, created_at`,
    [input.userId, input.companyId, input.disabled]
  );
  const row = result.rows[0];
  if (!row) throw new CompanyUserNotFoundError("User not found");
  if (input.disabled) await deleteSessionsForUser(input.userId);
  return mapCompanyUserRow(row);
}
