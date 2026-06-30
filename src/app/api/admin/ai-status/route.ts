import { NextResponse } from "next/server";
import { getAIStatus } from "@/server/platform/ai-status";
import { requireRole, requireUser } from "@/server/platform/auth-service";
import { ADMIN_ROLES } from "@/server/platform/types";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";

export async function GET() {
  try {
    const user = await requireUser();
    requireRole(user, ADMIN_ROLES);
    return NextResponse.json(getAIStatus());
  } catch (error) {
    return authErrorResponse(error) ?? serverError("admin/ai-status", error, "Unable to load AI status");
  }
}
