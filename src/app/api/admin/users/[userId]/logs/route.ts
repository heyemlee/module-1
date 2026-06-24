import { NextResponse } from "next/server";
import { requireUser, requireRole } from "@/server/platform/auth-service";
import { getUserRenderingStats } from "@/server/platform/user-admin-repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);

    const { userId } = await context.params;
    const stats = await getUserRenderingStats(userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch user rendering logs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
