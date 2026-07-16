import { notFound, redirect } from "next/navigation";
import { Round2VisualPrototype } from "@/features/round2/round2-visual-prototype";
import { getCurrentUser } from "@/server/platform/auth-service";
import { getProjectForUser } from "@/server/platform/project-repository";
import {
  getRound1SnapshotById,
  listRenderings
} from "@/server/platform/round1-postgres-repository";
import { getCurrentDesignBasis } from "@/server/platform/design-basis-repository";
import { listCabinetColorNames } from "@/server/platform/cabinet-color-repository";
import type { Round1ReferenceSource } from "@/features/round2/round2-types";
import {
  floorPlanWithMeasurementPresets,
  type Round1Snapshot
} from "@/features/round1/snapshot";
import { CABINET_STYLE_LABELS } from "@/features/round1/rendering-preferences";

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

function applianceLabels(snapshot: Round1Snapshot) {
  const form = snapshot.showroomForm;
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
  const [project, basis, renderings, colorNames] = await Promise.all([
    getProjectForUser(projectId, user),
    getCurrentDesignBasis(projectId),
    listRenderings(projectId),
    listCabinetColorNames(user.companyId)
  ]);
  if (!project) notFound();

  // The reference is resolved from the locked design basis — the exact snapshot
  // the customer-confirmed rendering was generated from — never from "the
  // latest snapshot", which may have drifted after confirmation.
  let reference: Round1ReferenceSource | null = null;
  if (basis) {
    const snapshotRecord = await getRound1SnapshotById(
      projectId,
      basis.round1SnapshotId
    );
    if (snapshotRecord) {
      const { snapshot } = snapshotRecord;
      const color = colorNames.find((item) => item.id === basis.doorColorId);
      reference = {
        id: snapshotRecord.id,
        generatedAt: snapshot.generatedAt,
        complete:
          snapshot.fixedPositionsConfirmed && snapshot.cabinetFillGenerated,
        layoutLabel:
          LAYOUT_LABELS[snapshot.floorPlan.layoutPreference] ??
          snapshot.floorPlan.layoutPreference,
        styleLabel: CABINET_STYLE_LABELS[basis.cabinetStyle],
        colorLabel: color?.name ?? "Color not selected",
        appliances: applianceLabels(snapshot),
        confirmationCount: snapshot.confirmationItems.length,
        floorPlan: floorPlanWithMeasurementPresets(snapshot)
      };
    }
  }

  return (
    <Round2VisualPrototype
      projectId={projectId}
      projectName={project.projectName}
      customerName={project.customerName}
      actualRole={user.role}
      reference={reference}
      basis={
        basis && reference
          ? { version: basis.version, lockedAt: basis.lockedAt }
          : null
      }
      hasRenderings={renderings.length > 0}
    />
  );
}
