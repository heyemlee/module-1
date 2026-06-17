import { NextResponse } from "next/server";
import { z } from "zod";
import { round1Repository } from "@/server/round1/round1-repository";
import type { Round1Snapshot } from "@/features/round1/snapshot";

// The snapshot embeds full floor-plan geometry, so we validate the Round 1
// safety invariants (it must be a generated, sales-only, non-production
// snapshot) and pass the rest through rather than re-specifying every field.
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const snapshot = snapshotRequestSchema.parse(body) as unknown as Round1Snapshot;
    const project = await round1Repository.saveSnapshot(id, snapshot);

    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid Round 1 snapshot", issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "Round 1 project not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Unable to save Round 1 snapshot" },
      { status: 500 }
    );
  }
}
