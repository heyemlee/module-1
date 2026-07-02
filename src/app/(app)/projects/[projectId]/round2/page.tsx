import { notFound, redirect } from "next/navigation";
import { Round2VisualPrototype } from "@/features/round2/round2-visual-prototype";
import { getCurrentUser } from "@/server/platform/auth-service";
import { getProjectForUser } from "@/server/platform/project-repository";

export default async function ProjectRound2Page({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;
  const project = await getProjectForUser(projectId, user);
  if (!project) notFound();

  return (
    <Round2VisualPrototype
      projectId={projectId}
      projectName={project.projectName}
      customerName={project.customerName}
      actualRole={user.role}
    />
  );
}
