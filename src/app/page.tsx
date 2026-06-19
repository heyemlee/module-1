import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/platform/auth-service";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/projects" : "/login");
}
