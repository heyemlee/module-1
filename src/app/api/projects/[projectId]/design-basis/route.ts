import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { getProjectForUser } from "@/server/platform/project-repository";
import {
  getCurrentDesignBasis,
  lockDesignBasis
} from "@/server/platform/design-basis-repository";

const requestSchema = z.object({
  renderingId: z.string().uuid()
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, user);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ basis: await getCurrentDesignBasis(projectId) });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      serverError("design-basis:get", error, "Unable to load design basis")
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, user);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let input: z.infer<typeof requestSchema>;
    try {
      input = requestSchema.parse(await request.json());
    } catch {
      return NextResponse.json(
        { error: "A renderingId is required" },
        { status: 400 }
      );
    }

    const result = await lockDesignBasis({
      projectId,
      renderingId: input.renderingId,
      user
    });
    if (result === "RENDERING_NOT_FOUND") {
      return NextResponse.json({ error: "Rendering not found" }, { status: 404 });
    }
    if (result === "MISSING_PREFERENCES") {
      return NextResponse.json(
        {
          error:
            "This rendering has no recorded style/color and cannot anchor a design basis"
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ basis: result }, { status: 201 });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      serverError("design-basis:lock", error, "Unable to lock design basis")
    );
  }
}
