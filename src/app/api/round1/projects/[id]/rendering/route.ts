import { NextResponse } from "next/server";
import { z } from "zod";
import { round1Repository } from "@/server/round1/round1-repository";

const requestSchema = z
  .object({
    // One or more base64 PNGs (no data: prefix) of the deterministic reference
    // views, rendered client-side from the locked snapshot geometry. They are
    // non-authoritative spatial references only; all authoritative data is
    // loaded from the saved snapshot server-side.
    referenceImagesBase64: z.array(z.string().min(1)).min(1).optional(),
    // Legacy single-image field, still accepted for backward compatibility.
    referenceImageBase64: z.string().min(1).optional()
  })
  .refine(
    (value) =>
      (value.referenceImagesBase64?.length ?? 0) > 0 ||
      !!value.referenceImageBase64,
    { message: "At least one reference image is required" }
  );

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid Round 1 rendering request", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid Round 1 rendering request" },
      { status: 400 }
    );
  }

  // Load the authoritative snapshot server-side. The client never supplies the
  // snapshot for rendering; only the non-authoritative reference image.
  const project = await round1Repository.getProject(id);
  if (!project) {
    return NextResponse.json(
      { error: "Round 1 project not found" },
      { status: 404 }
    );
  }
  if (!project.snapshot) {
    return NextResponse.json(
      {
        error: "Round 1 snapshot has not been generated for this project",
        reason: "NO_SNAPSHOT"
      },
      { status: 409 }
    );
  }

  const preferences = project.snapshot.showroomForm.renderingPreferences;
  if (!preferences?.doorColorId) {
    return NextResponse.json(
      {
        error: "A door color is required before generating a Round 1 rendering",
        reason: "DOOR_COLOR_REQUIRED"
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Legacy Round 1 rendering cannot resolve cabinet color library metadata",
      reason: "PROJECT_COLOR_LIBRARY_REQUIRED"
    },
    { status: 409 }
  );
}
