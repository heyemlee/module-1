import { Round1Feedback } from "./round1-feedback";
import { useState } from "react";
import {
  type PreliminaryCabinetEstimateSummary
} from "@/domain/round1";
import { AIChatInput } from "@/components/ui/ai-chat-input";
import {
  summarizeRound1Snapshot,
  type Round1Snapshot
} from "./snapshot";
import { DownloadButton } from "@/features/platform/download-button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
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
  renderings,
  cabinetColors
}: {
  canRender: boolean;
  busy: boolean;
  error: string | null;
  renderings: { id: string; url: string; doorColorId: string | null }[];
  cabinetColors: { id: string; name: string }[];
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // If new renderings arrive, try to keep showing the latest (first) if we were at 0, 
  // or adjust index if needed. For simplicity, just bounding it.
  const index = Math.min(currentIndex, Math.max(0, renderings.length - 1));
  const currentRendering = renderings[index];

  // Newest rendering is at index 0, so "previous" walks toward older (higher index).
  const showPrev = () => setCurrentIndex((i) => Math.min(renderings.length - 1, i + 1));
  const showNext = () => setCurrentIndex((i) => Math.max(0, i - 1));

  return (
    <div className="space-y-2">
      {busy ? (
        <section
          aria-busy="true"
          aria-label="Building concept rendering"
          className="rounded-studio-panel border border-studio-line bg-studio-shell p-4"
        >
          <div className="overflow-hidden rounded-studio-control border border-studio-line bg-studio-surface">
            <div className="aspect-[16/10] animate-pulse bg-[linear-gradient(110deg,var(--studio-surface)_8%,var(--studio-raised)_18%,var(--studio-surface)_33%)] bg-[length:200%_100%] motion-reduce:animate-none" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-studio-ink">
                Building concept rendering
              </p>
              <p className="mt-1 text-[11px] text-studio-muted">
                The frozen floor plan and finish selection are being processed.
              </p>
            </div>
            <Round1Feedback state="generating" message="Generating" />
          </div>
        </section>
      ) : null}
      {!canRender ? (
        renderings.length > 0 ? (
          <Round1Feedback
            state="stale"
            message="Inputs changed. Generate a new rendering when ready."
          />
        ) : (
          <p className="text-xs leading-5 text-[var(--app-muted)]">
            Available after cabinet fill is generated and a cabinet color is confirmed.
          </p>
        )
      ) : null}
      {error && (
        <p className="rounded-lg bg-[var(--app-red-soft)] px-3 py-2 text-xs leading-5 text-[var(--app-red)]">
          Could not generate the rendering: {error}
        </p>
      )}
      {currentRendering && (
        <figure className="image-generation-preview mt-3 space-y-1 relative group">
          <div className="relative flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              aria-label="Enlarge concept rendering"
              className="block w-full cursor-zoom-in overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-ink)] focus-visible:ring-offset-2"
            >
              <img
                src={currentRendering.url}
                alt="Round 1 concept rendering"
                className="aspect-video w-full rounded-lg object-cover transition hover:opacity-90"
              />
            </button>
            {currentRendering.doorColorId && cabinetColors.find(c => c.id === currentRendering.doorColorId)?.name && (
              <div className="absolute top-3 left-3 rounded bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm pointer-events-none">
                {cabinetColors.find(c => c.id === currentRendering.doorColorId)?.name}
              </div>
            )}
            <div className="absolute bottom-3 right-3">
              <DownloadButton
                href={currentRendering.url}
                fileName="concept-rendering.png"
              />
            </div>

            {renderings.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100 disabled:hidden"
                  onClick={showPrev}
                  disabled={index === renderings.length - 1}
                  aria-label="Previous rendering"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100 disabled:hidden"
                  onClick={showNext}
                  disabled={index === 0}
                  aria-label="Next rendering"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
                <div className="absolute bottom-3 left-3 flex gap-1">
                  {renderings.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full transition-all ${i === index ? "bg-white scale-110" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </figure>
      )}

      <Dialog open={isFullscreen && Boolean(currentRendering)} onOpenChange={setIsFullscreen}>
        <DialogContent
          className="max-h-[95vh] max-w-[95vw]"
          onKeyDown={(e) => {
            if (renderings.length <= 1) return;
            if (e.key === "ArrowLeft") showPrev();
            else if (e.key === "ArrowRight") showNext();
          }}
        >
          <DialogTitle className="sr-only">Concept rendering preview</DialogTitle>
          {currentRendering && (
            <>
              <img
                src={currentRendering.url}
                alt="Fullscreen rendering"
                className="max-h-[95vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
              />
              {currentRendering.doorColorId && cabinetColors.find(c => c.id === currentRendering.doorColorId)?.name && (
                <div className="absolute top-4 left-4 rounded-md bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md pointer-events-none">
                  {cabinetColors.find(c => c.id === currentRendering.doorColorId)?.name}
                </div>
              )}
              <DialogClose
                className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
                aria-label="Close fullscreen"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </DialogClose>
              <div className="absolute bottom-4 right-4">
                <DownloadButton
                  href={currentRendering.url}
                  fileName="concept-rendering.png"
                />
              </div>
              {renderings.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition hover:bg-black/80 disabled:hidden"
                    onClick={showPrev}
                    disabled={index === renderings.length - 1}
                    aria-label="Previous rendering"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition hover:bg-black/80 disabled:hidden"
                    onClick={showNext}
                    disabled={index === 0}
                    aria-label="Next rendering"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
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
