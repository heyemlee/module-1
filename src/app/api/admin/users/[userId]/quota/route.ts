import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireRole } from "@/server/platform/auth-service";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { setCompanyUserQuota, CompanyUserNotFoundError } from "@/server/platform/user-admin-repository";

const requestSchema = z.object({
  quota: z.number().int().min(0)
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);

    const { userId } = await params;
    const input = requestSchema.parse(await request.json());

    const updated = await setCompanyUserQuota({
      companyId: user.companyId,
      userId,
      monthlyRenderQuota: input.quota
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid quota request", issues: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof CompanyUserNotFoundError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return authErrorResponse(error) ?? serverError("admin/user:quota", error, "Unable to update user quota");
  }
}
