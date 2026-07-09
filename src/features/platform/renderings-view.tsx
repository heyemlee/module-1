import Link from "next/link";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import type { DesignBasis } from "@/server/platform/design-basis-repository";
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
  confirmationCount: number;
  basedOnRenderingPreferences: {
    cabinetStyle: string;
    doorColorId: string;
  } | null;
};

export function RenderingsView({
  project,
  renderings,
  colors,
  basis
}: {
  project: { id: string; customerName: string; projectName: string };
  renderings: RenderingHistoryItem[];
  colors: { id: string; name: string }[];
  basis: DesignBasis | null;
}) {
  const colorNameById = new Map(colors.map((color) => [color.id, color.name]));

  return (
    <StudioPage>
      <StudioPageHeader
        title="Proposal & confirm"
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
              Open concept
            </Link>
          </Button>
        }
      />

      <section
        data-testid="design-basis-bar"
        className="mt-6 flex flex-col gap-3 rounded-studio-panel border border-studio-line bg-white/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-studio-ink text-white">
            <LockClosedIcon aria-hidden />
          </span>
          {basis ? (
            <div>
              <p className="text-[13px] font-semibold text-studio-ink">
                Design basis v{basis.version} locked
              </p>
              <p className="mt-0.5 text-[12px] text-studio-muted">
                {STYLE_LABELS[basis.cabinetStyle] ?? basis.cabinetStyle} ·{" "}
                {colorNameById.get(basis.doorColorId) ?? "Unknown color"} · locked{" "}
                {new Date(basis.lockedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
                . Technical design reads this basis; relocking archives its
                draft.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[13px] font-semibold text-studio-ink">
                No design basis yet
              </p>
              <p className="mt-0.5 text-[12px] text-studio-muted">
                Lock the rendering the customer confirmed. That packages its
                layout snapshot, style and color as the basis technical design
                starts from.
              </p>
            </div>
          )}
        </div>
        {basis && (
          <Button asChild size="sm" className="shrink-0 self-start sm:self-auto">
            <Link href={`/projects/${project.id}/round2`}>
              Open technical design
            </Link>
          </Button>
        )}
      </section>

      {renderings.length === 0 ? (
        <StudioSection className="mt-6">
          <StudioEmptyState
            title="No renderings yet"
            description="Complete the concept phase and generate the first rendering; the customer confirms one of them here."
            action={
              <Button asChild>
                <Link href={`/projects/${project.id}/round1`}>
                  Open concept
                </Link>
              </Button>
            }
          />
        </StudioSection>
      ) : (
        <RenderingsGallery
          customerName={project.customerName}
          projectId={project.id}
          currentBasis={
            basis
              ? {
                  version: basis.version,
                  renderingId: basis.renderingId,
                  lockedAt: basis.lockedAt
                }
              : null
          }
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
              downloadName: `rendering_${project.projectName.replace(/\s+/g, "_")}_${dateObj.getTime()}.png`,
              confirmationCount: rendering.confirmationCount,
              lockable: prefs !== null
            };
          })}
        />
      )}
    </StudioPage>
  );
}
