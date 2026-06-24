import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  StudioEmptyState,
  StudioPage,
  StudioPageHeader,
  StudioSection
} from "./studio-page";
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

export function RenderingsView({
  project,
  renderings,
  colors
}: {
  project: { id: string; customerName: string; projectName: string };
  renderings: RenderingHistoryItem[];
  colors: { id: string; name: string }[];
}) {
  const colorNameById = new Map(colors.map((color) => [color.id, color.name]));

  return (
    <StudioPage>
      <StudioPageHeader
        title="Renderings"
        description={`${project.customerName}. ${project.projectName}`}
        action={
          <Button asChild variant="secondary">
            <Link href={`/projects/${project.id}/round1`}>
              Open Round 1
            </Link>
          </Button>
        }
      />

      {renderings.length === 0 ? (
        <StudioSection className="mt-6">
          <StudioEmptyState
            title="No renderings yet"
            description="Complete Round 1 preferences and generate the first concept rendering."
            action={
              <Button asChild>
                <Link href={`/projects/${project.id}/round1`}>
                  Open Round 1
                </Link>
              </Button>
            }
          />
        </StudioSection>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3">
          {renderings.map((rendering, index) => {
            const prefs = rendering.basedOnRenderingPreferences;
            const colorName = prefs
              ? colorNameById.get(prefs.doorColorId) ?? "Unknown color"
              : "Finish not recorded";
            const style = prefs
              ? STYLE_LABELS[prefs.cabinetStyle] ?? prefs.cabinetStyle
              : null;
            const imageUrl = `/api/projects/${project.id}/round1/renderings/${rendering.id}/image`;
            const dateObj = new Date(rendering.createdAt);

            return (
              <figure
                key={rendering.id}
                className="group overflow-hidden rounded-studio-panel border border-studio-line bg-studio-shell"
              >
                <div className="relative overflow-hidden border-b border-studio-line bg-studio-void">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={`Concept rendering for ${project.customerName}`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                  />
                  {index === 0 && (
                    <span className="absolute left-3 top-3 inline-flex h-6 items-center rounded-full bg-studio-action/10 px-2.5 text-[10px] font-bold text-studio-action">
                      Latest
                    </span>
                  )}
                </div>
                <figcaption className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-[13px] font-semibold text-studio-ink">
                      {colorName}
                    </p>
                    {style && (
                      <p className="truncate text-[13px] text-studio-muted">
                        {style}
                      </p>
                    )}
                    <time
                      dateTime={rendering.createdAt}
                      className="block truncate text-[11px] text-studio-quiet"
                    >
                      {dateObj.toLocaleString()}
                    </time>
                  </div>
                  <DownloadButton
                    href={imageUrl}
                    fileName={`rendering_${project.projectName.replace(/\s+/g, "_")}_${dateObj.getTime()}.png`}
                  />
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </StudioPage>
  );
}
