import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/platform/auth-service";
import { ADMIN_ROLES } from "@/server/platform/types";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import {
  CompanyUserNotFoundError,
  setCompanyUserDisabled
} from "@/server/platform/user-admin-repository";

const statusSchema = z.object({
  disabled: z.boolean()
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
        { error: "You cannot change your own status" },
        { status: 400 }
      );
    }
    const input = statusSchema.parse(await request.json());
    const updated = await setCompanyUserDisabled({
      companyId: user.companyId,
      userId,
      disabled: input.disabled
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid user status request", issues: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof CompanyUserNotFoundError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return serverError("admin/user-status", error, "Unable to update user status");
  }
}
