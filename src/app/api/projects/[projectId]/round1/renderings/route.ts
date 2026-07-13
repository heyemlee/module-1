import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAIImageAdapterFromEnv } from "@/infrastructure/image/openai-rest-image-client";
import { createVisionClientFromEnv } from "@/infrastructure/image/openai-vision-client";
import { generateRound1Rendering } from "@/server/round1/rendering-service";
import { verifyConceptRendering } from "@/server/round1/rendering-verification";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { rateLimit } from "@/server/platform/rate-limit";
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
  saveRenderingHistory,
  getRenderCountForCurrentMonth
} from "@/server/platform/round1-postgres-repository";

const requestSchema = z.object({
  referenceImages: z.array(
    z.object({
      role: z.enum([
        "PERSPECTIVE_STRUCTURE",
        "TOP_DOWN_PLAN",
        "MATERIAL_SWATCH"
      ]),
      imageBase64: z.string().min(1)
    })
  ).min(1)
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
    return authErrorResponse(error) ?? serverError("renderings:list", error, "Unable to list renderings");
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
    return authErrorResponse(error) ?? serverError("renderings:create", error, "Unable to generate Round 1 concept rendering");
  }

  // Per-user throttle on the expensive image-generation call.
  const limit = rateLimit(`rendering:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
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

  const roles = new Set(input.referenceImages.map((r) => r.role));
  if (!roles.has("TOP_DOWN_PLAN")) {
    return NextResponse.json(
      { error: "Missing required spatial reference (top-down plan)" },
      { status: 400 }
    );
  }
  if (roles.size !== input.referenceImages.length) {
    return NextResponse.json(
      { error: "Duplicate reference roles are not allowed" },
      { status: 400 }
    );
  }

  const roleOrder = [
    "TOP_DOWN_PLAN",
    "MATERIAL_SWATCH"
  ] as const;

  const orderedBase64 = roleOrder
    .map((role) => input.referenceImages.find((r) => r.role === role)?.imageBase64)
    .filter((b64): b64 is string => b64 !== undefined);

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
    return NextResponse.json({ error: "OpenAI image generation is not configured", reason: "OPENAI_IMAGE_API_KEYS_NOT_CONFIGURED" }, { status: 503 });
  }

  const currentMonthRenders = await getRenderCountForCurrentMonth(user.id);
  if (currentMonthRenders >= user.monthlyRenderQuota) {
    return NextResponse.json(
      { error: "You have exceeded your monthly rendering quota", reason: "QUOTA_EXCEEDED" },
      { status: 403 }
    );
  }

  // Surface the real failure reason instead of an opaque 500: image-model
  // errors and DB save errors are reported with their message and logged so the
  // cause is visible in both the UI and the server logs.
  try {
    const rendering = await generateRound1Rendering({
      snapshot: latest.snapshot,
      referenceImagesBase64: orderedBase64,
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

    // Optional closed-loop check: ask a vision model whether the rendering
    // matches the authoritative plan inventory. Off by default (extra paid call
    // per render); enable with ROUND1_VERIFY_RENDERING=1. Never fails the
    // request — discrepancies are attached to the response and logged.
    // ponytail: surfaces discrepancies only; add an auto-repair regenerate pass
    // here if the caught mismatches turn out to warrant it.
    let verification;
    if (process.env.ROUND1_VERIFY_RENDERING === "1") {
      const visionClient = createVisionClientFromEnv(process.env);
      if (visionClient) {
        try {
          verification = await verifyConceptRendering({
            imageBase64: rendering.imageBase64,
            snapshot: latest.snapshot,
            client: visionClient
          });
          if (!verification.ok) {
            console.warn(
              "Round 1 rendering verification found discrepancies",
              verification.discrepancies
            );
          }
        } catch (verifyError) {
          console.error("Round 1 rendering verification failed", verifyError);
        }
      }
    }

    return NextResponse.json(
      verification ? { ...saved, verification } : saved,
      { status: 200 }
    );
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
