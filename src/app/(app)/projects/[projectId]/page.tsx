import { notFound, redirect } from "next/navigation";
import { ProjectDetail } from "@/features/platform/project-detail";
import { getCurrentUser } from "@/server/platform/auth-service";
import { getProjectForUser } from "@/server/platform/project-repository";
import {
  getLatestRound1Snapshot,
  getRound1State,
  listRenderings
} from "@/server/platform/round1-postgres-repository";

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

  const [round1State, snapshot, renderings] = await Promise.all([
    getRound1State(projectId),
    getLatestRound1Snapshot(projectId),
    listRenderings(projectId)
  ]);

  return (
    <ProjectDetail
      project={project}
      progress={{
        hasRound1State: Boolean(round1State),
        hasSnapshot: Boolean(snapshot),
        latestRendering: renderings[0]
          ? {
              id: renderings[0].id,
              createdAt: renderings[0].createdAt
            }
          : null
      }}
    />
  );
}
