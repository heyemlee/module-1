import {
  type PreliminaryCabinetEstimateSummary
} from "@/domain/round1";
import {
  summarizeRound1Snapshot,
  type Round1Snapshot
} from "./snapshot";

export type SnapshotPersistState = "idle" | "saving" | "saved" | "error";

export function CabinetFillSummaryPanel({
  summary,
  positionsConfirmed,
  cabinetFillGenerated
}: {
  summary: PreliminaryCabinetEstimateSummary;
  positionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
}) {
  if (!positionsConfirmed) {
    return (
      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Position setup first
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Confirm dragged door, window, and appliance positions before cabinet fill.
        </p>
      </div>
    );
  }

  if (!cabinetFillGenerated) {
    return (
      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Fixed positions confirmed
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Generate cabinet fill when the fixed positions are ready.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Rough cabinet fill
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <CabinetSummaryMetric
            label="Base"
            count={summary.baseCabinets.count}
            linearFeet={summary.baseCabinets.linearFeet}
          />
          <CabinetSummaryMetric
            label="Wall"
            count={summary.wallCabinets.count}
            linearFeet={summary.wallCabinets.linearFeet}
          />
          <CabinetSummaryMetric
            label="Tall"
            count={summary.tallCabinets.count}
            linearFeet={summary.tallCabinets.linearFeet}
          />
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Filler
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">
              ~{summary.estimatedFillerWidth}"
            </p>
            <p className="text-xs font-bold text-slate-500">allowance</p>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Pricing reserved
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Dollar pricing is intentionally left for a later quote step.
          </p>
        </div>
      </div>
    </div>
  );
}

function CabinetSummaryMetric({
  label,
  count,
  linearFeet
}: {
  label: string;
  count: number;
  linearFeet: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{count}</p>
      <p className="text-xs font-bold text-slate-500">~{linearFeet} lf</p>
    </div>
  );
}

function RenderingControls({
  canRender,
  busy,
  error,
  stale,
  image,
  onGenerate
}: {
  canRender: boolean;
  busy: boolean;
  error: string | null;
  stale: boolean;
  image: string | null;
  onGenerate?: () => void;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onGenerate}
        disabled={!canRender || busy}
        className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Generating Rendering…"
          : image && stale
            ? "Regenerate Rendering"
            : "Generate Rendering"}
      </button>
      {!canRender ? (
        <p className="text-xs leading-5 text-slate-500">
          {image
            ? "Regenerate cabinet fill, then re-run to refresh this preview."
            : "Available after cabinet fill is generated."}
        </p>
      ) : (
        <p className="text-xs leading-5 text-slate-500">
          Sends a clean deterministic layout image plus a wall-by-wall
          description of this locked snapshot to the image model. The result is a
          concept preview only.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          Could not generate the rendering: {error}
        </p>
      )}
      {image && (
        <figure className="space-y-1">
          {stale && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] font-bold leading-4 text-amber-800">
              Outdated — this concept is based on an earlier snapshot. Regenerate
              cabinet fill, then re-run Generate Rendering to refresh it.
            </p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Round 1 concept rendering"
            className={`w-full rounded-md border border-slate-200 ${
              stale ? "opacity-60" : ""
            }`}
          />
          <figcaption className="text-[11px] leading-4 text-slate-500">
            Concept preview only — never the source of truth for cabinet data,
            dimensions, counts, geometry, or quotes.
          </figcaption>
        </figure>
      )}
    </div>
  );
}

export function Round1SnapshotPanel({
  snapshot,
  persistState = "idle",
  renderingBusy = false,
  renderingImage = null,
  renderingError = null,
  renderingStale = false,
  canRender = false,
  onGenerateRendering
}: {
  snapshot: Round1Snapshot | null;
  persistState?: SnapshotPersistState;
  renderingBusy?: boolean;
  renderingImage?: string | null;
  renderingError?: string | null;
  renderingStale?: boolean;
  canRender?: boolean;
  onGenerateRendering?: () => void;
}) {
  const renderingControls = (
    <RenderingControls
      canRender={canRender}
      busy={renderingBusy}
      error={renderingError}
      stale={renderingStale}
      image={renderingImage}
      onGenerate={onGenerateRendering}
    />
  );

  if (!snapshot) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            No snapshot yet
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Generate cabinet fill to freeze the authoritative Round 1 sales
            snapshot. Until then, form and position changes stay draft only.
          </p>
        </div>
        {renderingControls}
      </div>
    );
  }

  const summary = summarizeRound1Snapshot(snapshot);

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-emerald-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Snapshot ready
        </p>
        <p className="mt-1 text-xs font-bold text-emerald-800">
          Generated {snapshot.generatedAt}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
          <span className="rounded bg-white px-2 py-1 text-slate-700">
            {summary.totalCabinets} cabinets
          </span>
          <span className="rounded bg-white px-2 py-1 text-slate-700">
            {summary.confirmationCount} to confirm
          </span>
          <span className="rounded bg-white px-2 py-1 text-slate-700">
            ~{summary.estimatedFillerWidth}&quot; filler
          </span>
        </div>
        <SnapshotPersistStatus persistState={persistState} />
      </div>

      {renderingControls}

      <details className="rounded-md border border-slate-200">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-700">
          View snapshot JSON
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-700">
{JSON.stringify(snapshot, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function SnapshotPersistStatus({
  persistState
}: {
  persistState: SnapshotPersistState;
}) {
  if (persistState === "idle") return null;

  const config = {
    saving: { text: "Saving to server…", className: "text-slate-500" },
    saved: { text: "Saved to server", className: "text-emerald-700" },
    error: {
      text: "Couldn’t reach server — snapshot kept locally.",
      className: "text-amber-700"
    }
  }[persistState];

  return (
    <p className={`mt-2 text-[11px] font-bold ${config.className}`}>
      {config.text}
    </p>
  );
}
