import { NextResponse } from "next/server";
import { z } from "zod";
import { ForbiddenError, requireRole, requireUser } from "@/server/platform/auth-service";
import { ADMIN_ROLES, CREATABLE_BY, canCreateRole, type UserRole } from "@/server/platform/types";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import {
  CompanyUserNotFoundError,
  isAssignableRole,
  setCompanyUserRole
} from "@/server/platform/user-admin-repository";

const roleSchema = z.object({
  role: z.string().refine(isAssignableRole, "Unknown role")
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await requireUser();
    requireRole(user, ADMIN_ROLES);
    const { userId } = await params;
    if (user.id === userId) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      );
    }
    const input = roleSchema.parse(await request.json());
    // An actor may only grant a role it could create (admins can't grant ADMIN
    // or OWNER). The repo's manageable-set then limits which users can be re-roled.
    if (!canCreateRole(user.role, input.role as UserRole)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    const updated = await setCompanyUserRole({
      companyId: user.companyId,
      userId,
      role: input.role as UserRole,
      manageableRoles: CREATABLE_BY[user.role]
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    const auth = authErrorResponse(error, "Admins only");
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid user role request", issues: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof CompanyUserNotFoundError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return serverError("admin/user-role", error, "Unable to update user role");
  }
}
