import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/platform/auth-service";
import { LoginForm } from "@/features/platform/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/projects");
  return <LoginForm />;
}
