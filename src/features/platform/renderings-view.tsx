import Link from "next/link";
import type { AuthUser } from "@/server/platform/types";
import { DownloadButton } from "./download-button";


const STYLE_LABELS: Record<string, string> = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
};

type RenderingHistoryItem = {
  id: string;
  size: string;
  createdAt: string;
  basedOnRenderingPreferences: {
    cabinetStyle: string;
    doorColorId: string;
  } | null;
};

/**
 * Read-only gallery of a project's saved Round 1 concept renderings (history).
 * Concept images are non-authoritative, sales-estimate previews only.
 */
export function RenderingsView({
  project,
  renderings,
  colors,
  user
}: {
  project: { id: string; customerName: string; projectName: string };
  renderings: RenderingHistoryItem[];
  colors: { id: string; name: string }[];
  user: AuthUser;
}) {
  const colorNameById = new Map(colors.map((color) => [color.id, color.name]));
  const isAdmin = user.role === "ADMIN";

  return (
    <main className="min-h-[100dvh] bg-[#f5f5f7] text-[#1d1d1f]">

      <div className="mx-auto max-w-[1320px] px-8 py-10">

        {renderings.length === 0 ? (
          <div className="mt-8 rounded-[18px] border border-dashed border-[#d2d2d7] bg-white p-12 text-center">
            <p className="text-[14px] font-semibold text-[#1d1d1f]">No renderings yet</p>
            <p className="mt-2 text-[13px] text-[#6e6e73]">
              Generate a concept rendering from the{" "}
              <Link
                href={`/projects/${project.id}/round1`}
                className="font-semibold text-[#1d1d1f] underline"
              >
                Round 1 Intake
              </Link>{" "}
              step and it will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {renderings.map((rendering, index) => {
              const prefs = rendering.basedOnRenderingPreferences;
              const colorName = prefs
                ? colorNameById.get(prefs.doorColorId) ?? "Unknown color"
                : "—";
              const style = prefs
                ? STYLE_LABELS[prefs.cabinetStyle] ?? prefs.cabinetStyle
                : null;
              const imageUrl = `/api/projects/${project.id}/round1/renderings/${rendering.id}/image`;
              return (
                <figure
                  key={rendering.id}
                  className="group overflow-hidden rounded-[18px] border border-[#d2d2d7] bg-white"
                >
                  <div className="relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={`Concept rendering for ${project.customerName}`}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                    />
                    {index === 0 && (
                      <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-[#e6f4ef] px-3 text-[11px] font-bold text-[#008060]">
                        LATEST
                      </span>
                    )}
                  </div>
                  <figcaption className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#1d1d1f]">
                        {colorName}
                        {style ? ` · ${style}` : ""}
                      </p>
                      <p className="text-[11px] text-[#6e6e73]">
                        {new Date(rendering.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <DownloadButton
                      href={imageUrl}
                      fileName={`rendering_${project.projectName.replace(/\s+/g, "_")}_${new Date(rendering.createdAt).getTime()}.png`}
                    />
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
