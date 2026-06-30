import { redirect } from "next/navigation";
import { CabinetColorsAdminView } from "@/features/platform/cabinet-colors-admin-view";
import { getCurrentUser } from "@/server/platform/auth-service";
import { listCabinetColors } from "@/server/platform/cabinet-color-repository";

export default async function AdminCabinetColorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "OWNER") redirect("/projects");
  const colors = await listCabinetColors(user.companyId, false, {
    includeHoverExampleImages: false
  });
  return <CabinetColorsAdminView colors={colors} />;
}
