import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "./logout-button";

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
    <PageShell width="max-w-5xl" backHref={`/projects/${project.id}`} backLabel="Back to project" actions={<LogoutButton />}>
      <h1 className="text-2xl font-semibold">Renderings</h1>
      <p className="mt-1 text-muted-foreground">
        {project.customerName} · {project.projectName}
      </p>
      <p className="mt-1 text-xs text-subtle-foreground">
        Sales-estimate concept images only — not for production. Most recent first (up to 20).
      </p>

      {renderings.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm font-semibold">No renderings yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate a concept rendering from the{" "}
            <Link href={`/projects/${project.id}/round1`} className="font-medium text-primary underline-offset-2 hover:underline">
              Round 1 Intake
            </Link>{" "}
            step and it will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {renderings.map((rendering) => {
            const prefs = rendering.basedOnRenderingPreferences;
            const colorName = prefs ? colorNameById.get(prefs.doorColorId) ?? "Unknown color" : "—";
            const style = prefs ? STYLE_LABELS[prefs.cabinetStyle] ?? prefs.cabinetStyle : "—";
            return (
              <figure key={rendering.id} className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${rendering.imageBase64}`}
                  alt={`Concept rendering for ${project.customerName}`}
                  className="w-full"
                />
                <figcaption className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{colorName}</p>
                    <p className="text-xs text-subtle-foreground">{new Date(rendering.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge tone="neutral">{style}</Badge>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
