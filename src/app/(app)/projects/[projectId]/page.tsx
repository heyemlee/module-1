import { notFound, redirect } from "next/navigation";
import { ProjectDetail } from "@/features/platform/project-detail";
import { getCurrentUser } from "@/server/platform/auth-service";
import { getProjectForUser } from "@/server/platform/project-repository";
import { listCabinetColorNames } from "@/server/platform/cabinet-color-repository";
import {
  getLatestRound1Snapshot,
  getRound1State,
  listRenderings
} from "@/server/platform/round1-postgres-repository";
import { getCurrentDesignBasis } from "@/server/platform/design-basis-repository";

const CABINET_STYLE_LABELS: Record<string, string> = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
};

export default async function ProjectPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { projectId } = await params;
  const project = await getProjectForUser(projectId, user);
  if (!project) notFound();

  const [round1State, snapshot, renderings, colors, basis] = await Promise.all([
    getRound1State(projectId),
    getLatestRound1Snapshot(projectId),
    listRenderings(projectId),
    listCabinetColorNames(user.companyId),
    getCurrentDesignBasis(projectId)
  ]);

  const latest = renderings[0];
  const prefs = latest?.basedOnRenderingPreferences ?? null;

  return (
    <ProjectDetail
      project={project}
      progress={{
        hasRound1State: Boolean(round1State),
        hasSnapshot: Boolean(snapshot),
        basis: basis
          ? { version: basis.version, lockedAt: basis.lockedAt }
          : null,
        latestRendering: latest
          ? {
              id: latest.id,
              createdAt: latest.createdAt,
              styleLabel: prefs
                ? CABINET_STYLE_LABELS[prefs.cabinetStyle] ?? prefs.cabinetStyle
                : null,
              colorName: prefs
                ? colors.find((color) => color.id === prefs.doorColorId)?.name ??
                  null
                : null
            }
          : null
      }}
    />
  );
}
