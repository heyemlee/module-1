import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  requireRole,
  requireUser,
  UnauthorizedError
} from "@/server/platform/auth-service";
import {
  AccountAlreadyExistsError,
  createCompanyUser,
  isAssignableRole,
  listCompanyUsers
} from "@/server/platform/user-admin-repository";

const createSchema = z.object({
  account: z.string().trim().min(1),
  role: z.string().refine(isAssignableRole, "Unknown role"),
  password: z.string().min(8)
});

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    return NextResponse.json({ users: await listCompanyUsers(user.companyId) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Unable to list users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const input = createSchema.parse(await request.json());
    const created = await createCompanyUser({
      companyId: user.companyId,
      account: input.account,
      role: input.role,
      password: input.password
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid user request", issues: error.issues }, { status: 400 });
    }
    if (error instanceof AccountAlreadyExistsError) {
      return NextResponse.json({ error: "Account already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create user" }, { status: 500 });
  }
}
