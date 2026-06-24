import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/platform/auth-service";
import { GlobalSidebar } from "@/features/platform/global-sidebar";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[100dvh]">
      <GlobalSidebar userName={user.name} isAdmin={user.role === "ADMIN"} />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
