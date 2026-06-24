import { NextResponse } from "next/server";
import { requireRole, requireUser } from "@/server/platform/auth-service";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { getProjectForUser, deleteProjectForUser } from "@/server/platform/project-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, user);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    return authErrorResponse(error) ?? serverError("project:load", error, "Unable to load project");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const { projectId } = await params;
    const success = await deleteProjectForUser(projectId, user);
    if (!success) {
      return NextResponse.json({ error: "Project not found or forbidden" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? serverError("project:delete", error, "Unable to delete project");
  }
}
