import { NextResponse } from "next/server";
import { z } from "zod";
import type { Round1Snapshot } from "@/features/round1/snapshot";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse } from "@/server/platform/api-errors";
import { getProjectForUser } from "@/server/platform/project-repository";
import { saveRound1Snapshot } from "@/server/platform/round1-postgres-repository";

const snapshotRequestSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    generatedAt: z.string().min(1),
    fixedPositionsConfirmed: z.literal(true),
    cabinetFillGenerated: z.literal(true),
    salesEstimateOnly: z.literal(true),
    notForProduction: z.literal(true),
    dimensionConfidence: z.literal("ROUGH")
  })
  .passthrough();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, user);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const snapshot = snapshotRequestSchema.parse(await request.json()) as unknown as Round1Snapshot;
    const snapshotId = await saveRound1Snapshot({ projectId, user, snapshot });
    return NextResponse.json({ snapshotId });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid Round 1 snapshot", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Unable to save Round 1 snapshot" }, { status: 500 });
  }
}
