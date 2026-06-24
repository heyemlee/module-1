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
  | "INTAKE"
  | "RENDERING_READY"
  | "ROUND2_MEASURING"
  | "ARCHIVED";
