import Link from "next/link";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { CabinetColorForm } from "./cabinet-color-form";
import { LogoutButton } from "./logout-button";

const STYLE_LABELS = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
} as const;

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
          <div className="space-y-6">
            {(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"] as const).map((style) => {
              const group = colors.filter((color) => color.cabinetStyle === style);
              return (
                <section key={style} className="rounded border border-stone-300 bg-white">
                  <h2 className="border-b border-stone-200 px-4 py-3 text-lg font-semibold">{STYLE_LABELS[style]}</h2>
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    {group.map((color) => (
                      <article key={color.id} className="rounded border border-stone-200 p-3">
                        <div className="aspect-square overflow-hidden rounded border border-stone-200 bg-stone-100">
                          {color.swatchImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={color.swatchImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full" style={{ background: color.swatchHex ?? "#e7e5e4" }} />
                          )}
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{color.name}</p>
                          </div>
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${color.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                            {color.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium text-stone-700">Edit {color.name}</summary>
                          <div className="mt-3">
                            <CabinetColorForm color={color} />
                          </div>
                        </details>
                      </article>
                    ))}
                    {group.length === 0 && <p className="text-sm text-stone-600">No colors configured.</p>}
                  </div>
                </section>
              );
            })}
          </div>
          <CabinetColorForm />
        </section>
      </div>
    </main>
  );
}
