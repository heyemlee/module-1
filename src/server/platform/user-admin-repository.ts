import { query } from "@/server/db/client";
import { hashPassword } from "./passwords";
import type { UserRole } from "./types";

export type CompanyUserSummary = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  disabledAt: string | null;
  createdAt: string;
};

type CompanyUserRow = {
  id: string;
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
    email: row.email,
    name: row.name,
    role: row.role,
    disabledAt: row.disabled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString()
  };
}

export async function listCompanyUsers(companyId: string) {
  const result = await query<CompanyUserRow>(
    `SELECT id, email, name, role, disabled_at, created_at
     FROM users
     WHERE company_id = $1
     ORDER BY created_at ASC`,
    [companyId]
  );
  return result.rows.map(mapCompanyUserRow);
}

export class EmailAlreadyExistsError extends Error {}

export async function createCompanyUser(input: {
  companyId: string;
  email: string;
  name: string;
  role: UserRole;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const result = await query<CompanyUserRow>(
    `INSERT INTO users (company_id, email, name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, name, role, disabled_at, created_at`,
    [input.companyId, input.email, input.name, passwordHash, input.role]
  );
  const row = result.rows[0];
  if (!row) throw new EmailAlreadyExistsError("Email already in use");
  return mapCompanyUserRow(row);
}
