import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAIImageAdapterFromEnv } from "@/infrastructure/image/openai-rest-image-client";
import { generateRound1Rendering } from "@/server/round1/rendering-service";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse } from "@/server/platform/api-errors";
import type { AuthUser } from "@/server/platform/types";
import {
  getCabinetColor,
  isColorCompatibleWithStyle
} from "@/server/platform/cabinet-color-repository";
import { getProjectForUser } from "@/server/platform/project-repository";
import {
  getLatestRound1Snapshot,
  getRound1State,
  listRenderings,
  saveRenderingHistory
} from "@/server/platform/round1-postgres-repository";

const requestSchema = z.object({
  referenceImagesBase64: z.array(z.string().min(1)).min(1)
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, user);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ renderings: await listRenderings(projectId) });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unable to list renderings" }, { status: 500 })
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let user: AuthUser;
  try {
    user = await requireUser();
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unable to generate Round 1 concept rendering" }, { status: 500 })
    );
  }
  const { projectId } = await params;
  const project = await getProjectForUser(projectId, user);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid rendering request", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid rendering request" }, { status: 400 });
  }

  const state = await getRound1State(projectId);
  const preferences = state?.showroomForm.renderingPreferences;
  if (!state || !preferences?.doorColorId) {
    return NextResponse.json(
      { error: "Round 1 door color required", reason: "DOOR_COLOR_REQUIRED" },
      { status: 409 }
    );
  }

  const color = await getCabinetColor(user.companyId, preferences.doorColorId);
  if (!color || !isColorCompatibleWithStyle(color, preferences.cabinetStyle)) {
    return NextResponse.json(
      { error: "Invalid Round 1 door color", reason: "INVALID_DOOR_COLOR" },
      { status: 409 }
    );
  }

  const latest = await getLatestRound1Snapshot(projectId);
  if (!latest) return NextResponse.json({ error: "Round 1 snapshot required" }, { status: 409 });
  const adapter = createOpenAIImageAdapterFromEnv(process.env);
  if (!adapter) {
    return NextResponse.json({ error: "OpenAI image generation is not configured", reason: "OPENAI_API_KEY_NOT_CONFIGURED" }, { status: 503 });
  }

  // Surface the real failure reason instead of an opaque 500: image-model
  // errors and DB save errors are reported with their message and logged so the
  // cause is visible in both the UI and the server logs.
  try {
    const rendering = await generateRound1Rendering({
      snapshot: latest.snapshot,
      referenceImagesBase64: input.referenceImagesBase64,
      renderingPreferences: {
        cabinetStyle: preferences.cabinetStyle,
        color
      },
      adapter
    });
    const saved = await saveRenderingHistory({
      projectId,
      snapshotId: latest.id,
      user,
      rendering
    });
    return NextResponse.json(saved, { status: 200 });
  } catch (error) {
    console.error("Round 1 rendering failed", error);
    return NextResponse.json(
      {
        error: "Unable to generate Round 1 concept rendering",
        reason: error instanceof Error ? error.message : "UNKNOWN_ERROR"
      },
      { status: 502 }
    );
  }
}
