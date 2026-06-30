import { notFound, redirect } from "next/navigation";
import { ShowroomIntakeApp } from "@/features/round1/showroom-intake-app";
import { getCurrentUser } from "@/server/platform/auth-service";
import { getProjectForUser } from "@/server/platform/project-repository";

export default async function ProjectRound1Page({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ intake?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { projectId } = await params;
  const project = await getProjectForUser(projectId, user);
  if (!project) notFound();
  const { intake } = await searchParams;
  return (
    <ShowroomIntakeApp
      projectId={projectId}
      customerName={project.customerName}
      projectName={project.projectName}
      userName={user.name}
      isAdmin={user.role === "ADMIN" || user.role === "OWNER"}
      initialIntake={intake}
    />
  );
}
