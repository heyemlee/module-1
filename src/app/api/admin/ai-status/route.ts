import { NextResponse } from "next/server";
import { getAIStatus } from "@/server/platform/ai-status";
import { requireRole, requireUser } from "@/server/platform/auth-service";

export async function GET() {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  return NextResponse.json(getAIStatus());
}
