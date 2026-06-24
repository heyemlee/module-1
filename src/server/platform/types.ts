export type UserRole = "ADMIN" | "SALES" | "DESIGNER";

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
  | "DRAFT"
  | "ROUND1_SNAPSHOT_READY"
  | "ROUND1_RENDERING_READY"
  | "NEEDS_CONFIRMATION"
  | "ROUND2_READY"
  | "ARCHIVED";
