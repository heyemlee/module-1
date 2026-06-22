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

export function RenderingControls({
  canRender,
  busy,
  error,
  stale,
  image
}: {
  canRender: boolean;
  busy: boolean;
  error: string | null;
  stale: boolean;
  image: string | null;
}) {
  return (
    <div className="space-y-2 mt-4">
      {busy ? (
        <p className="rounded-md bg-sky-50 px-3 py-2 text-xs font-bold leading-5 text-sky-800">
          Generating rendering...
        </p>
      ) : null}
      {!canRender ? (
        <p className="text-xs leading-5 text-slate-500">
          {image
            ? "Regenerate cabinet fill and confirm rendering preferences, then re-run to refresh this preview."
            : "Available after cabinet fill is generated and a cabinet color is confirmed."}
        </p>
      ) : null}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          Could not generate the rendering: {error}
        </p>
      )}
      {image && (
        <figure className="space-y-1 mt-3">
          {stale && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] font-bold leading-4 text-amber-800">
              Outdated — please regenerate rendering to update.
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
        </figure>
      )}
    </div>
  );
}

export function Round1SnapshotPanel({
  snapshot,
  persistState = "idle",
  onRetrySave
}: {
  snapshot: Round1Snapshot | null;
  persistState?: SnapshotPersistState;
  onRetrySave?: () => void;
}) {
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
        <SnapshotPersistStatus persistState={persistState} onRetrySave={onRetrySave} />
      </div>

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
  persistState,
  onRetrySave
}: {
  persistState: SnapshotPersistState;
  onRetrySave?: () => void;
}) {
  if (persistState === "idle") return null;

  if (persistState === "error") {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-[11px] font-bold text-amber-700">
          Couldn’t reach the server — snapshot kept locally.
        </p>
        {onRetrySave ? (
          <button
            type="button"
            onClick={onRetrySave}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700"
          >
            Retry save
          </button>
        ) : null}
      </div>
    );
  }

  const config = {
    saving: { text: "Saving to server…", className: "text-slate-500" },
    saved: { text: "Saved to server", className: "text-emerald-700" }
  }[persistState];

  return (
    <p className={`mt-2 text-[11px] font-bold ${config.className}`}>
      {config.text}
    </p>
  );
}
