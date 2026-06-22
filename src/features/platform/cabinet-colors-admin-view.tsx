import Link from "next/link";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { CabinetColorForm } from "./cabinet-color-form";
import { CabinetColorsManager } from "./cabinet-colors-manager";
import { LogoutButton } from "./logout-button";

export function CabinetColorsAdminView({ colors }: { colors: CabinetColor[] }) {
  return (
    <main className="min-h-screen bg-stone-100 px-6 py-8 text-stone-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <Link href="/projects" className="text-sm text-stone-600">Back to projects</Link>
          <LogoutButton />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Cabinet Colors</h1>
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <CabinetColorsManager colors={colors} />
          <CabinetColorForm />
        </section>
      </div>
    </main>
  );
}
