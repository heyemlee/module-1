import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { PageShell } from "@/components/page-shell";
import { CabinetColorForm } from "./cabinet-color-form";
import { CabinetColorsManager } from "./cabinet-colors-manager";
import { LogoutButton } from "./logout-button";

export function CabinetColorsAdminView({ colors }: { colors: CabinetColor[] }) {
  return (
    <PageShell backHref="/projects" backLabel="Back to projects" actions={<LogoutButton />}>
      <h1 className="text-2xl font-semibold">Cabinet Colors</h1>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <CabinetColorsManager colors={colors} />
        <CabinetColorForm />
      </section>
    </PageShell>
  );
}
