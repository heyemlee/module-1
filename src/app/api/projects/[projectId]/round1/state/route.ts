import { NextResponse } from "next/server";
import { z } from "zod";
import { round1FormSchema } from "@/domain/round1";
import type { PositionOverrides } from "@/features/round1/floorplan/plan-geometry";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { getProjectForUser } from "@/server/platform/project-repository";
import { getLatestRound1Snapshot, getRound1State, saveRound1State } from "@/server/platform/round1-postgres-repository";

const requestSchema = z.object({
  showroomForm: round1FormSchema,
  positionOverrides: z.record(z.string(), z.unknown()),
  fixedPositionsConfirmed: z.boolean(),
  cabinetFillGenerated: z.boolean(),
  currentStep: z.number().int().min(0).default(0),
  maxAccessibleStep: z.number().int().min(0).default(0)
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
    const state = await getRound1State(projectId);
    const latestSnapshot = await getLatestRound1Snapshot(projectId);
    return NextResponse.json({ state, latestSnapshot });
  } catch (error) {
    return authErrorResponse(error) ?? serverError("round1-state:load", error, "Unable to load Round 1 state");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, user);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const input = requestSchema.parse(await request.json());
    const state = await saveRound1State({
      projectId,
      user,
      showroomForm: input.showroomForm,
      positionOverrides: input.positionOverrides as PositionOverrides,
      fixedPositionsConfirmed: input.fixedPositionsConfirmed,
      cabinetFillGenerated: input.cabinetFillGenerated,
      currentStep: input.currentStep,
      maxAccessibleStep: input.maxAccessibleStep
    });
    return NextResponse.json({ state });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid Round 1 state", issues: error.issues },
        { status: 400 }
      );
    }
    return serverError("round1-state:save", error, "Unable to save Round 1 state");
  }
}
