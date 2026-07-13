import { Round1Feedback } from "./round1-feedback";
import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils";
import type { WallElevationScene } from "./elevations/elevation-scene";
import { WallElevationSvg } from "./elevations/elevation-preview";
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

// Newton's cradle: calm placeholder shown while a render image loads or when it
// fails — replaces the browser's broken-image icon on the dark canvas.
function NewtonsCradle({ label }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="newtons-cradle" role="status" aria-label={label ?? "Loading rendering"}>
        <div className="newtons-cradle__dot" />
        <div className="newtons-cradle__dot" />
        <div className="newtons-cradle__dot" />
        <div className="newtons-cradle__dot" />
      </div>
      {label && (
        <p className="max-w-xs px-8 text-center text-[11.5px] leading-5 text-white/55">
          {label}
        </p>
      )}
    </div>
  );
}

const MAX_RENDER_LOAD_ATTEMPTS = 3;
const DEFAULT_RENDERING_ASPECT_RATIO = 1536 / 1024;

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
      <div className="rounded-studio-control bg-studio-paper-muted p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-studio-paper-muted-ink">
          Position setup first
        </p>
        <p className="mt-2 text-sm leading-6 text-studio-paper-muted-ink">
          Confirm dragged door, window, and appliance positions before cabinet fill.
        </p>
      </div>
    );
  }

  if (!cabinetFillGenerated) {
    return (
      <div className="rounded-studio-control bg-studio-paper-muted p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-studio-paper-muted-ink">
          Fixed positions confirmed
        </p>
        <p className="mt-2 text-sm leading-6 text-studio-paper-muted-ink">
          Generate cabinet fill when the fixed positions are ready.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-studio-control bg-studio-paper-muted p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-studio-paper-muted-ink">
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
          <div className="rounded-studio-small border border-studio-paper-line bg-studio-paper p-2">
            <p className="text-xs font-black uppercase tracking-wide text-studio-paper-muted-ink">
              Filler
            </p>
            <p className="mt-1 text-lg font-black text-studio-paper-ink">
              ~{summary.estimatedFillerWidth}"
            </p>
            <p className="text-xs font-bold text-studio-paper-muted-ink">allowance</p>
          </div>
        </div>
        <div className="mt-3 rounded-studio-small border border-dashed border-studio-paper-line bg-studio-paper px-3 py-2">
          <p className="text-xs font-black uppercase tracking-wide text-studio-paper-muted-ink">
            Pricing reserved
          </p>
          <p className="mt-1 text-xs leading-5 text-studio-paper-muted-ink">
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
    <div className="rounded-studio-small border border-studio-paper-line bg-studio-paper p-2">
      <p className="text-xs font-black uppercase tracking-wide text-studio-paper-muted-ink">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-studio-paper-ink">{count}</p>
      <p className="text-xs font-bold text-studio-paper-muted-ink">~{linearFeet} lf</p>
    </div>
  );
}

// Design's in-canvas concept preview: a dark panel pinned to the top of the
// floor-plan canvas on the Rendering step. Shows the render-cube loader while
// generating, then the latest concept image with a carousel + "View all".
export function Round1InlineRenderPreview({
  busy,
  error,
  renderings,
  cabinetColors,
  styleLabel,
  fitViewport = false
}: {
  busy: boolean;
  error: string | null;
  renderings: { id: string; url: string; doorColorId: string | null }[];
  cabinetColors: { id: string; name: string }[];
  styleLabel: string;
  fitViewport?: boolean;
}) {
  // Newest first; "previous" walks toward older (higher index).
  const [index, setIndex] = useState(0);
  // Track render URLs whose <img> failed to load (after retries) so we can
  // show the cradle instead of the browser's broken-image icon on the dark
  // canvas. A single transient failure fetching the image bytes (e.g. DB pool
  // contention) shouldn't read as "this rendering is broken" when the
  // underlying render saved fine, so failures are retried with backoff first.
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [imageAspectRatio, setImageAspectRatio] = useState(
    DEFAULT_RENDERING_ASPECT_RATIO
  );
  const idx = Math.min(index, Math.max(0, renderings.length - 1));
  const current = renderings[idx];

  useEffect(() => {
    setLoadAttempt(0);
    setImageAspectRatio(DEFAULT_RENDERING_ASPECT_RATIO);
  }, [current?.url]);

  const imageBroken = current ? failedUrls.has(current.url) : false;
  const imageSrc =
    current &&
    (loadAttempt === 0
      ? current.url
      : `${current.url}${current.url.includes("?") ? "&" : "?"}retry=${loadAttempt}`);

  const handleImageError = () => {
    if (!current) return;
    if (loadAttempt + 1 < MAX_RENDER_LOAD_ATTEMPTS) {
      const delay = 500 * 2 ** loadAttempt;
      setTimeout(() => setLoadAttempt((a) => a + 1), delay);
    } else {
      setFailedUrls((prev) => new Set(prev).add(current.url));
    }
  };

  const retryImage = () => {
    if (!current) return;
    setFailedUrls((prev) => {
      if (!prev.has(current.url)) return prev;
      const next = new Set(prev);
      next.delete(current.url);
      return next;
    });
    setLoadAttempt(0);
  };
  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth <= 0 || naturalHeight <= 0) return;

    const ratio = naturalWidth / naturalHeight;
    if (Number.isFinite(ratio) && ratio > 0) {
      setImageAspectRatio(ratio);
    }
  };
  const colorName = current?.doorColorId
    ? cabinetColors.find((c) => c.id === current.doorColorId)?.name ?? null
    : null;
  const meta = colorName?.toUpperCase() ?? "";
  const hasOlder = idx < renderings.length - 1;
  const hasNewer = idx > 0;

  const arrow =
    "absolute top-1/2 z-[5] flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(20,20,22,0.14)] bg-white/80 text-[16px] text-[#222225] shadow-[0_14px_34px_-20px_rgba(20,20,26,0.6)] backdrop-blur-sm transition hover:bg-white disabled:opacity-30";
  const frameBackground = "linear-gradient(162deg,#3a3a3e,#101012)";
  const frameStyle = fitViewport
    ? {
        background: frameBackground,
        aspectRatio: imageAspectRatio,
        width: `min(100cqw, calc(100cqh * ${imageAspectRatio}))`
      }
    : { background: frameBackground, aspectRatio: imageAspectRatio };

  return (
    <div
      data-rendering-fit={fitViewport ? "viewport" : undefined}
      className={cn(
        "relative z-[3] shrink-0 overflow-visible",
        fitViewport
          ? "max-h-full max-w-full"
          : "mx-[18px] mt-[14px] w-auto"
      )}
      style={frameStyle}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[16px] shadow-[0_22px_50px_-24px_rgba(20,20,26,0.5),0_1px_0_rgba(255,255,255,0.4)_inset]">
        {busy ? (
          <div className="cmx">
          <div className="cmx-space">
            <div className="cmx-cube">
              <div className="cmx-face cmx-f-f" />
              <div className="cmx-face cmx-f-b" />
              <div className="cmx-face cmx-f-r" />
              <div className="cmx-face cmx-f-l" />
              <div className="cmx-face cmx-f-t" />
              <div className="cmx-face cmx-f-bt" />
            </div>
            <div className="cmx-pop">RENDER</div>
          </div>
          </div>
        ) : error ? (
          <NewtonsCradle label={`Could not generate the rendering: ${error}`} />
        ) : imageBroken ? (
          <button
            type="button"
            onClick={retryImage}
            className="flex h-full w-full flex-col items-center justify-center"
          >
            <NewtonsCradle label="Rendering image unavailable. Tap to retry." />
          </button>
        ) : !current ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="font-mono text-[10px] tracking-[0.14em] text-white/45">
              CONCEPT RENDERING
            </p>
            <p className="max-w-xs text-[12px] leading-5 text-white/45">
              Lock a cabinet finish, then generate to preview the concept here.
            </p>
          </div>
        ) : (
          <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={imageSrc}
            src={imageSrc}
            alt="Latest concept rendering"
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={cn(
              "absolute inset-0 h-full w-full",
              fitViewport ? "object-contain" : "object-cover"
            )}
          />
          {idx === 0 && (
            <span className="absolute left-[18px] top-[14px] inline-flex h-6 items-center rounded-full bg-studio-action px-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-studio-action-ink z-[4]">
              Latest
            </span>
          )}
          {renderings.length > 1 && (
            <span className="absolute left-1/2 top-[14px] -translate-x-1/2 font-mono text-[9px] tracking-[0.12em] text-white/70">
              {idx + 1} / {renderings.length}
            </span>
          )}
          {meta && (
            <div className="absolute bottom-4 left-[18px] z-[4] max-w-[calc(100%-36px)] rounded-full bg-[rgba(20,20,22,0.68)] px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] text-white shadow-[0_10px_24px_-18px_rgba(0,0,0,0.8)] backdrop-blur-sm">
              {meta}
            </div>
          )}
          </>
        )}
      </div>
      {renderings.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(renderings.length - 1, i + 1))}
            disabled={!hasOlder}
            aria-label="Previous rendering"
            className={cn(arrow, "left-0 -translate-x-[calc(100%+8px)]")}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={!hasNewer}
            aria-label="Next rendering"
            className={cn(arrow, "right-0 translate-x-[calc(100%+8px)]")}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}

// Frosted strip of per-wall rough elevation thumbnails, pinned below the floor
// plan once cabinet fill exists (design's `hasFill` gate). Clicking opens the
// lightbox. Scenes are derived from the frozen snapshot plan so they match the
// generated fill, not in-progress drags.
export function Round1ElevationStrip({
  scenes,
  onOpen,
  leading
}: {
  scenes: WallElevationScene[];
  onOpen: (index: number) => void;
  // Optional item rendered first in the same row (e.g. the perspective thumb),
  // so the 3D reference lines up with the elevations instead of a separate bar.
  leading?: ReactNode;
}) {
  if (scenes.length === 0 && !leading) return null;

  return (
    <div
      className="studio-anim-rise relative z-[3] flex shrink-0 items-end gap-[10px] overflow-x-auto border-t border-white/50 px-[18px] py-[14px]"
      style={{
        background: "rgba(246,246,244,0.7)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)"
      }}
    >
      {leading}
      {scenes.map((scene, index) => (
        <div key={scene.wall} className="flex flex-col items-center gap-[5px]">
          <button
            type="button"
            onClick={() => onOpen(index)}
            aria-label={`Open ${scene.title} rough elevation`}
            className="flex aspect-video w-[112px] shrink-0 flex-col justify-center overflow-hidden rounded-[11px] border border-white/80 bg-white/[0.62] p-[7px] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] transition-colors hover:border-studio-ink"
          >
            <WallElevationSvg scene={scene} className="h-full w-full" />
          </button>
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[#9a9a94]">
            {scene.title}
          </span>
        </div>
      ))}
    </div>
  );
}

// Full-bleed glass lightbox for one wall elevation, with ‹ › wrap navigation,
// Esc/Arrow keys, and a "not for production" stamp. Backdrop click closes.
export function Round1ElevationLightbox({
  scenes,
  index,
  onClose,
  onSelect
}: {
  scenes: WallElevationScene[];
  index: number;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const total = scenes.length;
  const scene = scenes[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onSelect((index - 1 + total) % total);
      else if (event.key === "ArrowRight") onSelect((index + 1) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, onClose, onSelect]);

  if (!scene) return null;

  const arrow =
    "flex size-[52px] flex-none items-center justify-center rounded-full border border-white/85 bg-white/70 text-[22px] text-studio-ink shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_14px_30px_-14px_rgba(20,20,26,0.4)] transition hover:bg-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${scene.title} rough elevation`}
      onClick={onClose}
      className="studio-anim-fade fixed inset-0 z-[70] flex items-center justify-center gap-[26px] p-12"
      style={{
        background: "rgba(232,232,230,0.6)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)"
      }}
    >
      {total > 1 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect((index - 1 + total) % total);
          }}
          aria-label="Previous wall"
          className={arrow}
        >
          ‹
        </button>
      )}
      <div
        onClick={(event) => event.stopPropagation()}
        className="studio-anim-rise relative flex aspect-video max-h-[86vh] w-[min(88vw,940px)] flex-col overflow-hidden rounded-[24px] border border-white/90 bg-white p-[30px] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_40px_90px_-40px_rgba(20,20,26,0.5)]"
      >
        <div className="font-mono text-[11px] tracking-[0.18em] text-[#86867f]">
          ROUGH ELEVATION
        </div>
        <div className="mb-6 mt-[5px] text-[22px] font-semibold tracking-[-0.01em] text-studio-ink">
          {scene.title}
        </div>
        <div className="min-h-0 flex-1">
          <WallElevationSvg scene={scene} className="h-full w-full" />
        </div>
        <div className="mt-[18px] flex items-center justify-between font-mono text-[10px] tracking-[0.1em] text-[#9a9a94]">
          <span>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span>SALES ESTIMATE · NOT FOR PRODUCTION</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rough elevation"
          className="absolute right-[28px] top-[28px] flex size-10 items-center justify-center rounded-full border border-white/85 bg-white/70 text-[18px] text-[#6a6a64] transition hover:bg-white"
        >
          ×
        </button>
      </div>
      {total > 1 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect((index + 1) % total);
          }}
          aria-label="Next wall"
          className={arrow}
        >
          ›
        </button>
      )}
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
          className="studio-glass rounded-studio-panel p-4"
        >
          <div className="overflow-hidden rounded-studio-control border border-studio-line bg-studio-surface">
            <div className="relative aspect-[16/10] overflow-hidden">
              <div className="cmx">
                <div className="cmx-space">
                  <div className="cmx-cube">
                    <div className="cmx-face cmx-f-f" />
                    <div className="cmx-face cmx-f-b" />
                    <div className="cmx-face cmx-f-r" />
                    <div className="cmx-face cmx-f-l" />
                    <div className="cmx-face cmx-f-t" />
                    <div className="cmx-face cmx-f-bt" />
                  </div>
                  <div className="cmx-pop">RENDER</div>
                </div>
              </div>
            </div>
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
          <p className="text-xs leading-5 text-studio-muted">
            Available after cabinet fill is generated and a cabinet color is confirmed.
          </p>
        )
      ) : null}
      {error && (
        <p className="rounded-studio-control bg-studio-danger/15 px-3 py-2 text-xs leading-5 text-studio-danger">
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
              className="block w-full cursor-zoom-in overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-studio-action focus-visible:ring-offset-2 focus-visible:ring-offset-studio-void"
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
            {index === 0 && (
              <span className="absolute top-3 right-3 inline-flex h-6 items-center rounded-full bg-studio-action px-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-studio-action-ink z-[4] pointer-events-none">
                Latest
              </span>
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
        <div className="rounded-studio-control bg-studio-paper-muted p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-studio-paper-muted-ink">
            No snapshot yet
          </p>
          <p className="mt-2 text-sm leading-6 text-studio-paper-muted-ink">
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
      <div className="rounded-studio-control bg-studio-action p-3 text-studio-action-ink">
        <p className="text-xs font-bold uppercase tracking-wide">
          Snapshot ready
        </p>
        <p className="mt-1 text-xs font-bold">
          Generated {snapshot.generatedAt}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
          <span className="rounded-studio-small bg-studio-paper px-2 py-1 text-studio-paper-ink">
            {summary.totalCabinets} cabinets
          </span>
          <span className="rounded-studio-small bg-studio-paper px-2 py-1 text-studio-paper-ink">
            {summary.confirmationCount} to confirm
          </span>
          <span className="rounded-studio-small bg-studio-paper px-2 py-1 text-studio-paper-ink">
            ~{summary.estimatedFillerWidth}&quot; filler
          </span>
        </div>
        <SnapshotPersistStatus persistState={persistState} onRetrySave={onRetrySave} />
      </div>

      <details className="rounded-studio-control border border-studio-paper-line">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-studio-paper-ink">
          View snapshot JSON
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-studio-paper-line bg-studio-paper-muted px-3 py-2 text-[11px] leading-4 text-studio-paper-ink">
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
        <p className="text-[11px] font-bold text-studio-warning-ink">
          Couldn’t reach the server — snapshot kept locally.
        </p>
        {onRetrySave ? (
          <button
            type="button"
            onClick={onRetrySave}
            className="rounded-studio-small bg-studio-warning px-3 py-1.5 text-[11px] font-bold text-studio-warning-ink hover:brightness-105"
          >
            Retry save
          </button>
        ) : null}
      </div>
    );
  }

  const config = {
    saving: { text: "Saving to server…", className: "text-studio-action-ink/70" },
    saved: { text: "Saved to server", className: "text-studio-action-ink" }
  }[persistState];

  return (
    <p className={`mt-2 text-[11px] font-bold ${config.className}`}>
      {config.text}
    </p>
  );
}
