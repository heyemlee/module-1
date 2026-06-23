import {
  type PreliminaryCabinetEstimateSummary
} from "@/domain/round1";
import { AIChatInput } from "@/components/ui/ai-chat-input";
import {
  summarizeRound1Snapshot,
  type Round1Snapshot
} from "./snapshot";
import { DownloadButton } from "@/features/platform/download-button";
import "./ghost-loader.css";

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
      <div className="rounded-md bg-[#f5f5f7] p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
          Position setup first
        </p>
        <p className="mt-2 text-sm leading-6 text-[#6e6e73]">
          Confirm dragged door, window, and appliance positions before cabinet fill.
        </p>
      </div>
    );
  }

  if (!cabinetFillGenerated) {
    return (
      <div className="rounded-md bg-[#f5f5f7] p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
          Fixed positions confirmed
        </p>
        <p className="mt-2 text-sm leading-6 text-[#6e6e73]">
          Generate cabinet fill when the fixed positions are ready.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-[#f5f5f7] p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
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
          <div className="rounded-md border border-[#d2d2d7] bg-white p-2">
            <p className="text-xs font-black uppercase tracking-wide text-[#6e6e73]">
              Filler
            </p>
            <p className="mt-1 text-lg font-black text-[#1d1d1f]">
              ~{summary.estimatedFillerWidth}"
            </p>
            <p className="text-xs font-bold text-[#6e6e73]">allowance</p>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-dashed border-[#d2d2d7] bg-white px-3 py-2">
          <p className="text-xs font-black uppercase tracking-wide text-[#6e6e73]">
            Pricing reserved
          </p>
          <p className="mt-1 text-xs leading-5 text-[#6e6e73]">
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
    <div className="rounded-md border border-[#d2d2d7] bg-white p-2">
      <p className="text-xs font-black uppercase tracking-wide text-[#6e6e73]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[#1d1d1f]">{count}</p>
      <p className="text-xs font-bold text-[#6e6e73]">~{linearFeet} lf</p>
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
    <div className="mt-4 space-y-2">
      {busy ? (
        <div className="rendering-loader rounded-lg border border-[var(--app-border)] bg-white p-3">
          <GhostLoader />
          <p className="mt-2 bg-[linear-gradient(110deg,var(--app-muted),35%,var(--app-ink),50%,var(--app-muted),75%,var(--app-muted))] bg-[length:200%_100%] bg-clip-text text-sm font-semibold text-transparent [animation:rendering-shimmer_3s_linear_infinite]">
            Creating image. May take a moment.
          </p>
        </div>
      ) : null}
      {!canRender ? (
        <p className="text-xs leading-5 text-[var(--app-muted)]">
          {image
            ? "Regenerate cabinet fill and confirm rendering preferences, then re-run to refresh this preview."
            : "Available after cabinet fill is generated and a cabinet color is confirmed."}
        </p>
      ) : null}
      {error && (
        <p className="rounded-lg bg-[var(--app-red-soft)] px-3 py-2 text-xs leading-5 text-[var(--app-red)]">
          Could not generate the rendering: {error}
        </p>
      )}
      {image && (
        <figure className="image-generation-preview mt-3 space-y-1">
          {stale && (
            <p className="rounded-lg bg-[var(--app-amber-soft)] px-3 py-2 text-[11px] font-bold leading-4 text-[var(--app-amber)]">
              Outdated — please regenerate rendering to update.
            </p>
          )}
          <div className="relative flex flex-col gap-4">
            <img
              src={image}
              alt="Round 1 concept rendering"
              className={`aspect-video w-full rounded-lg object-cover ${stale ? "opacity-60" : ""}`}
            />
            <div className="absolute bottom-3 right-3">
              <DownloadButton
                imageBase64={image.replace("data:image/png;base64,", "")}
                fileName="concept-rendering.png"
              />
            </div>
          </div>
        </figure>
      )}
    </div>
  );
}

function GhostLoader() {
  return (
    <div className="gl-ghost" aria-hidden>
      <div className="gl-red">
        <div className="gl-top0"></div>
        <div className="gl-top1"></div>
        <div className="gl-top2"></div>
        <div className="gl-top3"></div>
        <div className="gl-top4"></div>
        <div className="gl-st0"></div>
        <div className="gl-st1"></div>
        <div className="gl-st2"></div>
        <div className="gl-st3"></div>
        <div className="gl-st4"></div>
        <div className="gl-st5"></div>
        <div className="gl-an1"></div>
        <div className="gl-an2"></div>
        <div className="gl-an3"></div>
        <div className="gl-an4"></div>
        <div className="gl-an5"></div>
        <div className="gl-an6"></div>
        <div className="gl-an7"></div>
        <div className="gl-an8"></div>
        <div className="gl-an9"></div>
        <div className="gl-an10"></div>
        <div className="gl-an11"></div>
        <div className="gl-an12"></div>
        <div className="gl-an13"></div>
        <div className="gl-an14"></div>
        <div className="gl-an15"></div>
        <div className="gl-an16"></div>
        <div className="gl-an17"></div>
        <div className="gl-an18"></div>
        <div className="gl-eye"></div>
        <div className="gl-eye1"></div>
        <div className="gl-pupil"></div>
        <div className="gl-pupil1"></div>
      </div>
      <div className="gl-shadow"></div>
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
        <div className="rounded-md bg-[#f5f5f7] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
            No snapshot yet
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6e6e73]">
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
      <div className="rounded-md bg-[#e6f4ef] p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#008060]">
          Snapshot ready
        </p>
        <p className="mt-1 text-xs font-bold text-[#008060]">
          Generated {snapshot.generatedAt}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
          <span className="rounded bg-white px-2 py-1 text-[#1d1d1f]">
            {summary.totalCabinets} cabinets
          </span>
          <span className="rounded bg-white px-2 py-1 text-[#1d1d1f]">
            {summary.confirmationCount} to confirm
          </span>
          <span className="rounded bg-white px-2 py-1 text-[#1d1d1f]">
            ~{summary.estimatedFillerWidth}&quot; filler
          </span>
        </div>
        <SnapshotPersistStatus persistState={persistState} onRetrySave={onRetrySave} />
      </div>

      <details className="rounded-md border border-[#d2d2d7]">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-[#1d1d1f]">
          View snapshot JSON
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[11px] leading-4 text-[#1d1d1f]">
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
        <p className="text-[11px] font-bold text-[#c56a16]">
          Couldn’t reach the server — snapshot kept locally.
        </p>
        {onRetrySave ? (
          <button
            type="button"
            onClick={onRetrySave}
            className="rounded-md bg-[#c56a16] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#a85a13]"
          >
            Retry save
          </button>
        ) : null}
      </div>
    );
  }

  const config = {
    saving: { text: "Saving to server…", className: "text-[#6e6e73]" },
    saved: { text: "Saved to server", className: "text-[#008060]" }
  }[persistState];

  return (
    <p className={`mt-2 text-[11px] font-bold ${config.className}`}>
      {config.text}
    </p>
  );
}
