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
    <div
      className="relative flex min-h-[100dvh] text-studio-ink"
      style={{
        background:
          "radial-gradient(125% 120% at 0% 0%,#f2f2f0 0%,#e9e9e6 52%,#e3e3df 100%)"
      }}
    >
      {/* soft environment blooms (handoff APP shell) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-[8%] left-[5%] h-[52%] w-[42%] bg-[radial-gradient(circle,rgba(255,255,255,0.7),transparent_62%)] blur-[34px]" />
        <div className="absolute -bottom-[14%] -right-[4%] h-[60%] w-[48%] bg-[radial-gradient(circle,rgba(204,206,210,0.5),transparent_64%)] blur-[50px]" />
      </div>

      <GlobalSidebar
        userName={user.name}
        userRole={user.role}
        isAdmin={user.role === "ADMIN"}
      />
      <div className="relative z-[1] min-w-0 flex-1">{children}</div>
    </div>
  );
}
