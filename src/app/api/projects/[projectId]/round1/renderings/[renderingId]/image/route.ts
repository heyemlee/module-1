import { NextResponse } from "next/server";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { getProjectForUser } from "@/server/platform/project-repository";
import { getRenderingImage } from "@/server/platform/round1-postgres-repository";

/**
 * Streams a single saved concept rendering as PNG bytes. The gallery list only
 * carries metadata; each `<img>` loads its image here lazily so the page no
 * longer inlines tens of MB of base64. Images are content-immutable per id, so
 * they are cached aggressively (and privately — they are tenant data).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; renderingId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId, renderingId } = await params;
    const project = await getProjectForUser(projectId, user);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const image = await getRenderingImage(projectId, renderingId);
    if (!image) return NextResponse.json({ error: "Rendering not found" }, { status: 404 });

    return new NextResponse(image, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    return authErrorResponse(error) ?? serverError("rendering-image", error, "Unable to load rendering image");
  }
}
