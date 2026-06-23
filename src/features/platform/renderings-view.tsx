import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { DownloadButton } from "./download-button";

const STYLE_LABELS: Record<string, string> = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
};

type RenderingHistoryItem = {
  id: string;
  imageBase64: string;
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
  colors
}: {
  project: { id: string; customerName: string; projectName: string };
  renderings: RenderingHistoryItem[];
  colors: { id: string; name: string }[];
}) {
  const colorNameById = new Map(colors.map((color) => [color.id, color.name]));

  return (
    <main className="app-page px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Link href={`/projects/${project.id}`} className="text-sm font-semibold text-[var(--app-blue)]">
            Back to project
          </Link>
          <LogoutButton />
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-normal text-[var(--app-ink)]">Renderings</h1>
        <p className="mt-2 text-[var(--app-muted)]">
          {project.customerName} · {project.projectName}
        </p>
        <p className="mt-1 text-xs text-[var(--app-muted)]">
          Sales-estimate concept images only — not for production. Most recent first
          (up to 20).
        </p>

        {renderings.length === 0 ? (
          <div className="app-panel-flat mt-6 border-dashed p-8 text-center">
            <p className="text-sm font-semibold text-[var(--app-ink)]">No renderings yet</p>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              Generate a concept rendering from the{" "}
              <Link
                href={`/projects/${project.id}/round1`}
                className="text-[var(--app-blue)] underline"
              >
                Round 1 Intake
              </Link>{" "}
              step and it will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {renderings.map((rendering) => {
              const prefs = rendering.basedOnRenderingPreferences;
              const colorName = prefs
                ? colorNameById.get(prefs.doorColorId) ?? "Unknown color"
                : "—";
              const style = prefs
                ? STYLE_LABELS[prefs.cabinetStyle] ?? prefs.cabinetStyle
                : "—";
              return (
                <figure
                  key={rendering.id}
                  className="app-panel overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${rendering.imageBase64}`}
                    alt={`Concept rendering for ${project.customerName}`}
                    className="w-full"
                  />
                  <figcaption className="border-t border-[var(--app-border)] px-4 py-3 flex items-center justify-between">
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold">{colorName}</p>
                      <p className="text-[var(--app-muted)]">{style}</p>
                      <p className="text-xs text-[var(--app-muted)]">
                        {new Date(rendering.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <DownloadButton
                      imageBase64={rendering.imageBase64}
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
