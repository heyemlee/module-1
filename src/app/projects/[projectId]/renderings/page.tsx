import { notFound, redirect } from "next/navigation";
import { RenderingsView } from "@/features/platform/renderings-view";
import { getCurrentUser } from "@/server/platform/auth-service";
import { listCabinetColors } from "@/server/platform/cabinet-color-repository";
import { getProjectForUser } from "@/server/platform/project-repository";
import { listRenderings } from "@/server/platform/round1-postgres-repository";

export default async function ProjectRenderingsPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { projectId } = await params;
  const project = await getProjectForUser(projectId, user);
  if (!project) notFound();

  const [renderings, colors] = await Promise.all([
    listRenderings(projectId),
    listCabinetColors(user.companyId)
  ]);

  return (
    <RenderingsView project={project} renderings={renderings} colors={colors} />
  );
}
