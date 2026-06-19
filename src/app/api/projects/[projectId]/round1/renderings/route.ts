import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAIImageAdapterFromEnv } from "@/infrastructure/image/openai-rest-image-client";
import { generateRound1Rendering } from "@/server/round1/rendering-service";
import { requireUser } from "@/server/platform/auth-service";
import { getProjectForUser } from "@/server/platform/project-repository";
import { getLatestRound1Snapshot, listRenderings, saveRenderingHistory } from "@/server/platform/round1-postgres-repository";

const requestSchema = z.object({
  referenceImagesBase64: z.array(z.string().min(1)).min(1)
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await getProjectForUser(projectId, user);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ renderings: await listRenderings(projectId) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await getProjectForUser(projectId, user);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const input = requestSchema.parse(await request.json());
  const latest = await getLatestRound1Snapshot(projectId);
  if (!latest) return NextResponse.json({ error: "Round 1 snapshot required" }, { status: 409 });
  const adapter = createOpenAIImageAdapterFromEnv(process.env);
  if (!adapter) {
    return NextResponse.json({ error: "OpenAI image generation is not configured", reason: "OPENAI_API_KEY_NOT_CONFIGURED" }, { status: 503 });
  }
  const rendering = await generateRound1Rendering({
    snapshot: latest.snapshot,
    referenceImagesBase64: input.referenceImagesBase64,
    adapter
  });
  const saved = await saveRenderingHistory({
    projectId,
    snapshotId: latest.id,
    user,
    rendering
  });
  return NextResponse.json(saved, { status: 200 });
}
