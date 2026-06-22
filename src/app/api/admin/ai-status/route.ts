import { NextResponse } from "next/server";
import { getAIStatus } from "@/server/platform/ai-status";
import { requireRole, requireUser } from "@/server/platform/auth-service";
import { authErrorResponse } from "@/server/platform/api-errors";

export async function GET() {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    return NextResponse.json(getAIStatus());
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unable to load AI status" }, { status: 500 })
    );
  }
}
