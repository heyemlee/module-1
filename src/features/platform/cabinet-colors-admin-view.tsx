import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { CabinetColorForm } from "./cabinet-color-form";
import { CabinetColorsManager } from "./cabinet-colors-manager";
import { PlatformHeader, NavPill } from "./platform-header";

export function CabinetColorsAdminView({
  colors,
  userName
}: {
  colors: CabinetColor[];
  userName: string;
}) {
  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <PlatformHeader
        userName={userName}
        nav={
          <>
            <NavPill href="/projects">Projects</NavPill>
            <NavPill href="/admin/users">Users</NavPill>
            <NavPill href="/admin/cabinet-colors" active>
              Cabinet Colors
            </NavPill>
          </>
        }
      />

      <div className="mx-auto max-w-[1320px] px-8 py-10">


        <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <CabinetColorsManager colors={colors} />
          <CabinetColorForm />
        </section>
      </div>
    </main>
  );
}
