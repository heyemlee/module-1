import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  StudioEmptyState,
  StudioPage,
  StudioPageHeader,
  StudioSection
} from "./studio-page";
import { RenderingsGallery, type RenderingCard } from "./renderings-gallery";

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
        meta={
          <Link
            href={`/projects/${project.id}`}
            className="inline-block font-mono text-[11px] tracking-[0.1em] text-[#86867f] transition-colors hover:text-studio-ink"
          >
            ← PROJECT OVERVIEW
          </Link>
        }
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
        <RenderingsGallery
          customerName={project.customerName}
          cards={renderings.map((rendering): RenderingCard => {
            const prefs = rendering.basedOnRenderingPreferences;
            const colorName = prefs
              ? colorNameById.get(prefs.doorColorId) ?? "Unknown color"
              : "Finish not recorded";
            const style = prefs
              ? STYLE_LABELS[prefs.cabinetStyle] ?? prefs.cabinetStyle
              : null;
            const dateObj = new Date(rendering.createdAt);

            return {
              id: rendering.id,
              imageUrl: `/api/projects/${project.id}/round1/renderings/${rendering.id}/image`,
              colorName,
              style,
              createdAt: rendering.createdAt,
              dateLabel: dateObj.toLocaleString(),
              downloadName: `rendering_${project.projectName.replace(/\s+/g, "_")}_${dateObj.getTime()}.png`
            };
          })}
        />
      )}
    </StudioPage>
  );
}
