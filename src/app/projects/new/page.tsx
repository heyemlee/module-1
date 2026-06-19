import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/platform/auth-service";
import { NewProjectForm } from "@/features/platform/new-project-form";

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <NewProjectForm />;
}
