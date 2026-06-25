import { redirect } from "next/navigation";
import { AdminUsersView } from "@/features/platform/admin-users-view";
import { getCurrentUser } from "@/server/platform/auth-service";
import { listCompanyUsers } from "@/server/platform/user-admin-repository";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/projects");
  const users = await listCompanyUsers(user.companyId);
  return <AdminUsersView users={users} currentUserId={user.id} />;
}
