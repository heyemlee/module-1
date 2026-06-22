import Link from "next/link";
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
    <main className="min-h-screen bg-stone-100 px-6 py-8 text-stone-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Link href={`/projects/${project.id}`} className="text-sm text-stone-600">
            Back to project
          </Link>
          <LogoutButton />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Renderings</h1>
        <p className="text-stone-700">
          {project.customerName} · {project.projectName}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Sales-estimate concept images only — not for production. Most recent first
          (up to 20).
        </p>

        {renderings.length === 0 ? (
          <div className="mt-6 rounded border border-dashed border-stone-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-stone-700">No renderings yet</p>
            <p className="mt-2 text-sm text-stone-600">
              Generate a concept rendering from the{" "}
              <Link
                href={`/projects/${project.id}/round1`}
                className="text-sky-700 underline"
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
                  className="overflow-hidden rounded border border-stone-300 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${rendering.imageBase64}`}
                    alt={`Concept rendering for ${project.customerName}`}
                    className="w-full"
                  />
                  <figcaption className="space-y-1 border-t border-stone-200 px-4 py-3 text-sm">
                    <p className="font-semibold">{colorName}</p>
                    <p className="text-stone-600">{style}</p>
                    <p className="text-xs text-stone-500">
                      {new Date(rendering.createdAt).toLocaleString()}
                    </p>
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
