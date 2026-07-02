import { notFound, redirect } from "next/navigation";
import { Round2VisualPrototype } from "@/features/round2/round2-visual-prototype";
import { getCurrentUser } from "@/server/platform/auth-service";
import { getProjectForUser } from "@/server/platform/project-repository";
import { getLatestRound1Snapshot } from "@/server/platform/round1-postgres-repository";
import { listCabinetColorNames } from "@/server/platform/cabinet-color-repository";
import type { Round1ReferenceSource } from "@/features/round2/round2-types";
import {
  CABINET_STYLE_LABELS,
  renderingPreferencesForForm
} from "@/features/round1/rendering-preferences";

const LAYOUT_LABELS: Record<string, string> = {
  ONE_WALL: "One-wall",
  LEFT_L_SHAPE: "Left L-shape",
  RIGHT_L_SHAPE: "Right L-shape",
  L_SHAPE: "L-shape",
  U_SHAPE: "U-shape",
  GALLEY: "Galley",
  PENINSULA: "Peninsula",
  ISLAND: "Island",
  L_SHAPE_ISLAND: "L-shape + island",
  U_SHAPE_ISLAND: "U-shape + island",
  NO_PREFERENCE: "Layout pending"
};

function applianceLabels(snapshot: Awaited<ReturnType<typeof getLatestRound1Snapshot>>) {
  if (!snapshot) return [];
  const form = snapshot.snapshot.showroomForm;
  return [
    form.fixtures.sink.status !== "NO" ? "Sink" : null,
    form.fixtures.fridge.status !== "NO" ? "Fridge" : null,
    form.fixtures.dishwasher.status === "YES" ? "Dishwasher" : null,
    "Range"
  ].filter((label): label is string => Boolean(label));
}

export default async function ProjectRound2Page({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;
  const [project, latestSnapshot, colorNames] = await Promise.all([
    getProjectForUser(projectId, user),
    getLatestRound1Snapshot(projectId),
    listCabinetColorNames(user.companyId)
  ]);
  if (!project) notFound();

  let reference: Round1ReferenceSource | null = null;
  if (latestSnapshot) {
    const preferences = renderingPreferencesForForm(
      latestSnapshot.snapshot.showroomForm
    );
    const color = colorNames.find(
      (item) => item.id === preferences.doorColorId
    );
    reference = {
      id: latestSnapshot.id,
      generatedAt: latestSnapshot.snapshot.generatedAt,
      complete:
        latestSnapshot.snapshot.fixedPositionsConfirmed &&
        latestSnapshot.snapshot.cabinetFillGenerated,
      layoutLabel:
        LAYOUT_LABELS[latestSnapshot.snapshot.floorPlan.layoutPreference] ??
        latestSnapshot.snapshot.floorPlan.layoutPreference,
      styleLabel: CABINET_STYLE_LABELS[preferences.cabinetStyle],
      colorLabel: color?.name ?? "Color not selected",
      appliances: applianceLabels(latestSnapshot),
      confirmationCount: latestSnapshot.snapshot.confirmationItems.length,
      floorPlan: latestSnapshot.snapshot.floorPlan
    };
  }

  return (
    <Round2VisualPrototype
      projectId={projectId}
      projectName={project.projectName}
      customerName={project.customerName}
      actualRole={user.role}
      reference={reference}
    />
  );
}
