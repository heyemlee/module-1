import { NextResponse } from "next/server";
import { z } from "zod";
import { ForbiddenError, requireRole, requireUser } from "@/server/platform/auth-service";
import { ADMIN_ROLES, canCreateRole, type UserRole } from "@/server/platform/types";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import {
  AccountAlreadyExistsError,
  createCompanyUser,
  isAssignableRole,
  listCompanyUsers
} from "@/server/platform/user-admin-repository";

const createSchema = z.object({
  account: z.string().trim().min(1),
  role: z.string().refine(isAssignableRole, "Unknown role"),
  password: z.string().min(8),
  monthlyRenderQuota: z.number().int().min(0).default(50)
});

export async function GET() {
  try {
    const user = await requireUser();
    requireRole(user, ADMIN_ROLES);
    return NextResponse.json({ users: await listCompanyUsers(user.companyId) });
  } catch (error) {
    return authErrorResponse(error, "Admins only") ?? serverError("admin/users:list", error, "Unable to list users");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, ADMIN_ROLES);
    const input = createSchema.parse(await request.json());
    // An actor may only create roles below its own (admins can't create admins).
    if (!canCreateRole(user.role, input.role as UserRole)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    const created = await createCompanyUser({
      companyId: user.companyId,
      account: input.account,
      role: input.role,
      password: input.password,
      monthlyRenderQuota: input.monthlyRenderQuota
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error, "Admins only");
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid user request", issues: error.issues }, { status: 400 });
    }
    if (error instanceof AccountAlreadyExistsError) {
      return NextResponse.json({ error: "Account already in use" }, { status: 409 });
    }
    return serverError("admin/users:create", error, "Unable to create user");
  }
}
