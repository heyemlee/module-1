import {
  type PreliminaryCabinetEstimateSummary
} from "@/domain/round1";
import {
  summarizeRound1Snapshot,
  type Round1Snapshot
} from "./snapshot";

export type SnapshotPersistState = "idle" | "saving" | "saved" | "error";

const noteCls = "rounded-md bg-surface-2 p-3";
const eyebrowCls = "font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

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
      <div className={noteCls}>
        <p className={eyebrowCls}>Position setup first</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Confirm dragged door, window, and appliance positions before cabinet fill.
        </p>
      </div>
    );
  }

  if (!cabinetFillGenerated) {
    return (
      <div className={noteCls}>
        <p className={eyebrowCls}>Fixed positions confirmed</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Generate cabinet fill when the fixed positions are ready.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className={eyebrowCls}>Rough cabinet fill</p>
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <CabinetSummaryMetric label="Base" count={summary.baseCabinets.count} linearFeet={summary.baseCabinets.linearFeet} />
        <CabinetSummaryMetric label="Wall" count={summary.wallCabinets.count} linearFeet={summary.wallCabinets.linearFeet} />
        <CabinetSummaryMetric label="Tall" count={summary.tallCabinets.count} linearFeet={summary.tallCabinets.linearFeet} />
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Filler</p>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">~{summary.estimatedFillerWidth}&quot;</p>
          <p className="text-[11px] text-subtle-foreground">allowance</p>
        </div>
      </div>
      <div className="rounded-md border border-dashed border-border bg-surface-2 px-3 py-2">
        <p className={eyebrowCls}>Pricing reserved</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Dollar pricing is intentionally left for a later quote step.
        </p>
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
    <div className="rounded-md border border-border bg-surface-2 p-2">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-foreground">{count}</p>
      <p className="text-[11px] text-subtle-foreground">~{linearFeet} lf</p>
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
    <div className="space-y-2">
      {busy ? (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-xs font-medium leading-5 text-primary">
          Generating rendering...
        </p>
      ) : null}
      {!canRender ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {image
            ? "Regenerate cabinet fill and confirm rendering preferences, then re-run to refresh this preview."
            : "Available after cabinet fill is generated and a cabinet color is confirmed."}
        </p>
      ) : null}
      {error && (
        <p className="rounded-md bg-danger-surface px-3 py-2 text-xs leading-5 text-danger-foreground">
          Could not generate the rendering: {error}
        </p>
      )}
      {image && (
        <figure className="mt-1 space-y-1">
          {stale && (
            <p className="rounded-md bg-warning-surface px-3 py-2 text-[11px] font-medium leading-4 text-warning-foreground">
              Outdated — please regenerate rendering to update.
            </p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Round 1 concept rendering"
            className={`w-full rounded-md border border-border ${stale ? "opacity-60" : ""}`}
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
      <div className={noteCls}>
        <p className={eyebrowCls}>No snapshot yet</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Generate cabinet fill to freeze the authoritative Round 1 sales snapshot. Until then,
          form and position changes stay draft only.
        </p>
      </div>
    );
  }

  const summary = summarizeRound1Snapshot(snapshot);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-success/20 bg-success-surface p-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-success-foreground">
          Snapshot ready
        </p>
        <p className="mt-1 text-xs font-medium text-success-foreground">Generated {snapshot.generatedAt}</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
          <span className="rounded bg-surface px-2 py-1 text-muted-foreground">{summary.totalCabinets} cabinets</span>
          <span className="rounded bg-surface px-2 py-1 text-muted-foreground">{summary.confirmationCount} to confirm</span>
          <span className="rounded bg-surface px-2 py-1 text-muted-foreground">~{summary.estimatedFillerWidth}&quot; filler</span>
        </div>
        <SnapshotPersistStatus persistState={persistState} onRetrySave={onRetrySave} />
      </div>

      <details className="rounded-md border border-border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
          View snapshot JSON
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-border bg-surface-2 px-3 py-2 font-mono text-[11px] leading-4 text-muted-foreground">
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
        <p className="text-[11px] font-medium text-warning-foreground">
          Couldn’t reach the server — snapshot kept locally.
        </p>
        {onRetrySave ? (
          <button
            type="button"
            onClick={onRetrySave}
            className="rounded-md bg-warning px-3 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Retry save
          </button>
        ) : null}
      </div>
    );
  }

  const config = {
    saving: { text: "Saving to server…", className: "text-muted-foreground" },
    saved: { text: "Saved to server", className: "text-success-foreground" }
  }[persistState];

  return <p className={`mt-2 text-[11px] font-medium ${config.className}`}>{config.text}</p>;
}
