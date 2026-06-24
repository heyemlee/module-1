import { redirect } from "next/navigation";
import { ProjectDashboard } from "@/features/platform/project-dashboard";
import { getCurrentUser } from "@/server/platform/auth-service";
import { listProjectsForUser } from "@/server/platform/project-repository";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const projects = await listProjectsForUser(user, params.q ?? "");
  return <ProjectDashboard user={user} projects={projects} query={params.q ?? ""} />;
}
