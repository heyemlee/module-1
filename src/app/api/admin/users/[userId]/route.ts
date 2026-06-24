import { NextResponse, type NextRequest } from "next/server";
import {
  ForbiddenError,
  requireRole,
  requireUser,
  UnauthorizedError
} from "@/server/platform/auth-service";
import { deleteCompanyUser } from "@/server/platform/user-admin-repository";

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const { userId } = await context.params;

    if (user.id === userId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    await deleteCompanyUser({
      companyId: user.companyId,
      userId: userId
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
