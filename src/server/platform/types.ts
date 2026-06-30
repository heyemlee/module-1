export type UserRole = "OWNER" | "ADMIN" | "SALES" | "DESIGNER";

// Roles each role may create through the admin UI/API. OWNER is intentionally
// absent from every list: owners exist only via promotion, never created in-app.
export const CREATABLE_BY: Record<UserRole, UserRole[]> = {
  OWNER: ["ADMIN", "SALES", "DESIGNER"],
  ADMIN: ["SALES", "DESIGNER"],
  DESIGNER: [],
  SALES: []
};

export function canCreateRole(actor: UserRole, target: UserRole) {
  return CREATABLE_BY[actor].includes(target);
}

// Roles with admin-area access (user management, project delete, see-all
// projects). OWNER is a superset of ADMIN.
export const ADMIN_ROLES: UserRole[] = ["ADMIN", "OWNER"];

export type AuthUser = {
  id: string;
  companyId: string;
  account: string;
  email: string;
  name: string;
  role: UserRole;
  disabledAt: string | null;
  monthlyRenderQuota: number;
};

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: string;
};

export type ProjectStatus =
  | "INTAKE"
  | "RENDERING_READY"
  | "ROUND2_MEASURING"
  | "ARCHIVED";
