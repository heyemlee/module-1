"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { DownloadButton } from "./download-button";
import { LockBasisButton, type DesignBasisRef } from "./design-basis-lock";

const MAX_LOAD_ATTEMPTS = 3;
const SWIPE_THRESHOLD_PX = 40;

/**
 * Each thumbnail's <img> makes its own lazy request for the image bytes,
 * separate from (and later than) the request that generated/saved the
 * rendering. A single transient failure (DB pool contention, cold connect)
 * would otherwise render as a permanently broken image even though the
 * rendering itself saved fine, so this retries a couple of times before
 * falling back to a manual retry control.
 */
function RenderingImage({
  src,
  alt,
  wrapperClassName,
  imgClassName,
  eager = false
}: {
  src: string;
  alt: string;
  wrapperClassName: string;
  imgClassName?: string;
  eager?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  const resolvedSrc =
    attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  const handleError = () => {
    if (attempt + 1 < MAX_LOAD_ATTEMPTS) {
      const delay = 500 * 2 ** attempt;
      setTimeout(() => setAttempt((a) => a + 1), delay);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div
        className={`${wrapperClassName} flex flex-col items-center justify-center gap-2 bg-studio-void/60 text-studio-muted`}
      >
        <span className="text-[11px]">Image failed to load</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setAttempt(0);
            setFailed(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.stopPropagation();
            e.preventDefault();
            setAttempt(0);
            setFailed(false);
          }}
          className="cursor-pointer rounded-full border border-studio-line px-3 py-1 text-[11px] font-medium hover:bg-studio-line/30"
        >
          Retry
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={resolvedSrc}
      src={resolvedSrc}
      alt={alt}
      loading={eager ? undefined : "lazy"}
      decoding="async"
      onError={handleError}
      className={`${wrapperClassName} ${imgClassName ?? ""}`}
    />
  );
}

export type RenderingCard = {
  id: string;
  /** Layout the image belongs to — renderings sharing it are colour variants. */
  layoutId: string;
  imageUrl: string;
  colorName: string;
  createdAt: string;
  dateLabel: string;
  downloadName: string;
  /** False for legacy rows without a style/color stamp — nothing to lock. */
  lockable: boolean;
};

type LayoutGroup = {
  layoutId: string;
  /** 1-based label ordinal ("Layout 1"), assigned by first appearance. */
  ordinal: number;
  variants: RenderingCard[];
};

/**
 * One window per layout: renderings that share a layout snapshot are the same
 * design in different finishes, so they collapse into a single card the sales
 * rep pages through by colour. Colour is never the decision that anchors
 * technical design — the locked layout is — so grouping keeps the choice about
 * layout while the finish stays a freely-browsed, freely-relocked variant.
 * Input order (newest-first) is preserved for both group and variant order.
 */
function groupByLayout(cards: RenderingCard[]): LayoutGroup[] {
  const order: string[] = [];
  const byLayout = new Map<string, RenderingCard[]>();

  for (const card of cards) {
    const existing = byLayout.get(card.layoutId);
    if (existing) {
      existing.push(card);
    } else {
      byLayout.set(card.layoutId, [card]);
      order.push(card.layoutId);
    }
  }

  return order.map((layoutId, index) => ({
    layoutId,
    ordinal: index + 1,
    variants: byLayout.get(layoutId) ?? []
  }));
}

function ChevronLeftGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  );
}

function ChevronRightGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}

export function RenderingsGallery({
  cards,
  customerName,
  projectId,
  currentBasis
}: {
  cards: RenderingCard[];
  customerName: string;
  projectId: string;
  currentBasis: DesignBasisRef | null;
}) {
  const groups = useMemo(() => groupByLayout(cards), [cards]);

  // Per-layout selected finish. A layout that already holds the basis opens on
  // the locked finish so "which colour did we confirm" is visible at a glance;
  // every other layout opens on its newest finish.
  const [selected, setSelected] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const group of groups) {
      const basisIndex = currentBasis
        ? group.variants.findIndex((v) => v.id === currentBasis.renderingId)
        : -1;
      initial[group.layoutId] = basisIndex >= 0 ? basisIndex : 0;
    }
    return initial;
  });
  const [openLayoutId, setOpenLayoutId] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const selectVariant = (layoutId: string, next: number, count: number) =>
    setSelected((prev) => ({
      ...prev,
      [layoutId]: Math.max(0, Math.min(count - 1, next))
    }));

  const openGroup =
    openLayoutId === null
      ? null
      : groups.find((g) => g.layoutId === openLayoutId) ?? null;
  const openIndex = openGroup ? selected[openGroup.layoutId] ?? 0 : 0;
  const openVariant = openGroup
    ? openGroup.variants[openIndex] ?? openGroup.variants[0]
    : null;

  return (
    <>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3">
        {groups.map((group) => {
          const count = group.variants.length;
          const index = Math.min(selected[group.layoutId] ?? 0, count - 1);
          const variant = group.variants[index] ?? group.variants[0];
          const basisIndex = currentBasis
            ? group.variants.findIndex((v) => v.id === currentBasis.renderingId)
            : -1;
          const groupHoldsBasis = basisIndex >= 0;
          const selectedIsBasis =
            currentBasis?.renderingId === variant.id && groupHoldsBasis;

          return (
            <figure
              key={group.layoutId}
              className="studio-glass group overflow-hidden rounded-studio-panel"
            >
              <div className="relative border-b border-studio-line bg-studio-void">
                <button
                  type="button"
                  onClick={() => setOpenLayoutId(group.layoutId)}
                  aria-label={`Enlarge layout ${group.ordinal} rendering for ${customerName}`}
                  className="relative block w-full cursor-zoom-in overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-studio-action"
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(e) => {
                    const startX = touchStartXRef.current;
                    touchStartXRef.current = null;
                    if (startX === null || count <= 1) return;
                    const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
                    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
                    selectVariant(group.layoutId, index + (dx < 0 ? 1 : -1), count);
                  }}
                >
                  <RenderingImage
                    src={variant.imageUrl}
                    alt={`Layout ${group.ordinal} rendering for ${customerName}`}
                    wrapperClassName="aspect-[4/3] w-full"
                    imgClassName="object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                  />
                </button>

                <span className="pointer-events-none absolute left-3 top-3 inline-flex h-6 items-center rounded-full bg-black/55 px-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                  Layout {group.ordinal}
                </span>
                {groupHoldsBasis && (
                  <span className="pointer-events-none absolute right-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-studio-ink px-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-white">
                    Basis v{currentBasis?.version}
                  </span>
                )}

                {count > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        selectVariant(group.layoutId, index - 1, count)
                      }
                      disabled={index === 0}
                      aria-label="Previous finish"
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white transition hover:bg-black/70 disabled:opacity-0"
                    >
                      <ChevronLeftGlyph />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        selectVariant(group.layoutId, index + 1, count)
                      }
                      disabled={index === count - 1}
                      aria-label="Next finish"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white transition hover:bg-black/70 disabled:opacity-0"
                    >
                      <ChevronRightGlyph />
                    </button>
                    <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5">
                      {group.variants.map((v, i) => (
                        <span
                          key={v.id}
                          className={`size-1.5 rounded-full ring-1 ring-black/30 transition ${
                            i === index
                              ? "bg-white"
                              : i === basisIndex
                                ? "bg-studio-action"
                                : "bg-white/45"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <figcaption className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-studio-ink">
                      {variant.colorName}
                    </p>
                    {count > 1 && (
                      <span className="shrink-0 font-mono text-[9px] tracking-[0.08em] text-studio-quiet">
                        FINISH {index + 1}/{count}
                      </span>
                    )}
                  </div>
                  <time
                    dateTime={variant.createdAt}
                    className="block truncate text-[11px] text-studio-quiet"
                  >
                    {variant.dateLabel}
                  </time>
                </div>
                <DownloadButton
                  href={variant.imageUrl}
                  fileName={variant.downloadName}
                />
              </figcaption>

              <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-studio-line px-4 py-2.5">
                {selectedIsBasis ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-ink px-3 py-1.5 font-mono text-[9px] tracking-[0.1em] text-white">
                    DESIGN BASIS v{currentBasis?.version}
                  </span>
                ) : variant.lockable ? (
                  <LockBasisButton
                    projectId={projectId}
                    renderingId={variant.id}
                    currentBasis={currentBasis}
                  />
                ) : (
                  <span className="text-[11px] text-studio-quiet">
                    No style/color recorded — cannot anchor a basis
                  </span>
                )}
              </div>
            </figure>
          );
        })}
      </div>

      <Dialog
        open={openVariant !== null}
        onOpenChange={(open) => {
          if (!open) setOpenLayoutId(null);
        }}
      >
        <DialogContent
          className="max-h-[95vh] max-w-[95vw]"
          onKeyDown={(e) => {
            if (!openGroup || openGroup.variants.length <= 1) return;
            if (e.key === "ArrowLeft") {
              selectVariant(openGroup.layoutId, openIndex - 1, openGroup.variants.length);
            } else if (e.key === "ArrowRight") {
              selectVariant(openGroup.layoutId, openIndex + 1, openGroup.variants.length);
            }
          }}
        >
          <DialogTitle className="sr-only">Layout rendering preview</DialogTitle>
          {openGroup && openVariant && (
            <>
              <RenderingImage
                src={openVariant.imageUrl}
                alt={`Layout ${openGroup.ordinal} rendering for ${customerName}`}
                wrapperClassName="max-h-[95vh] max-w-[95vw]"
                imgClassName="rounded-lg object-contain shadow-2xl"
                eager
              />
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-md bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-white/70">
                  Layout {openGroup.ordinal}
                </span>
                <span>{openVariant.colorName}</span>
                {openGroup.variants.length > 1 && (
                  <span className="font-mono text-[10px] font-normal text-white/60">
                    {openIndex + 1}/{openGroup.variants.length}
                  </span>
                )}
              </div>
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
                  href={openVariant.imageUrl}
                  fileName={openVariant.downloadName}
                />
              </div>
              {openGroup.variants.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition hover:bg-black/80 disabled:hidden"
                    onClick={() =>
                      selectVariant(openGroup.layoutId, openIndex - 1, openGroup.variants.length)
                    }
                    disabled={openIndex === 0}
                    aria-label="Previous finish"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition hover:bg-black/80 disabled:hidden"
                    onClick={() =>
                      selectVariant(openGroup.layoutId, openIndex + 1, openGroup.variants.length)
                    }
                    disabled={openIndex === openGroup.variants.length - 1}
                    aria-label="Next finish"
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
    </>
  );
}
