import { NextResponse, type NextRequest } from "next/server";
import { requireRole, requireUser } from "@/server/platform/auth-service";
import { ADMIN_ROLES } from "@/server/platform/types";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { deleteCompanyUser } from "@/server/platform/user-admin-repository";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await requireUser();
    requireRole(user, ADMIN_ROLES);
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
    return authErrorResponse(error, "Admins only") ?? serverError("admin/user:delete", error, "Unable to delete user");
  }
}
