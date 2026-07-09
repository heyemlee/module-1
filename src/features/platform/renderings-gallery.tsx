"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { DownloadButton } from "./download-button";
import { LockBasisButton, type DesignBasisRef } from "./design-basis-lock";

const MAX_LOAD_ATTEMPTS = 3;

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
  imageUrl: string;
  colorName: string;
  style: string | null;
  createdAt: string;
  dateLabel: string;
  downloadName: string;
  /** Open Confirmation Required items on the snapshot this image renders. */
  confirmationCount: number;
  /** False for legacy rows without a style/color stamp — nothing to lock. */
  lockable: boolean;
};

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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = openIndex === null ? null : cards[openIndex] ?? null;

  const showPrev = () =>
    setOpenIndex((i) => (i === null ? i : Math.max(0, i - 1)));
  const showNext = () =>
    setOpenIndex((i) =>
      i === null ? i : Math.min(cards.length - 1, i + 1)
    );

  return (
    <>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3">
        {cards.map((card, index) => (
          <figure
            key={card.id}
            className="studio-glass group overflow-hidden rounded-studio-panel"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Enlarge concept rendering for ${customerName}`}
              className="relative block w-full cursor-zoom-in overflow-hidden border-b border-studio-line bg-studio-void outline-none focus-visible:ring-2 focus-visible:ring-studio-action"
            >
              <RenderingImage
                src={card.imageUrl}
                alt={`Concept rendering for ${customerName}`}
                wrapperClassName="aspect-[4/3] w-full"
                imgClassName="object-cover transition-transform duration-500 group-hover:scale-[1.01]"
              />
              {index === 0 && (
                <span className="absolute left-3 top-3 inline-flex h-6 items-center rounded-full bg-studio-action px-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-studio-action-ink">
                  Latest
                </span>
              )}
            </button>
            <figcaption className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-[13px] font-semibold text-studio-ink">
                  {card.colorName}
                </p>
                {card.style && (
                  <p className="truncate text-[13px] text-studio-muted">
                    {card.style}
                  </p>
                )}
                <time
                  dateTime={card.createdAt}
                  className="block truncate text-[11px] text-studio-quiet"
                >
                  {card.dateLabel}
                </time>
              </div>
              <DownloadButton href={card.imageUrl} fileName={card.downloadName} />
            </figcaption>
            <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-studio-line px-4 py-2.5">
              {currentBasis?.renderingId === card.id ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-ink px-3 py-1.5 font-mono text-[9px] tracking-[0.1em] text-white">
                  DESIGN BASIS v{currentBasis.version}
                </span>
              ) : card.lockable ? (
                <LockBasisButton
                  projectId={projectId}
                  renderingId={card.id}
                  colorName={card.colorName}
                  styleLabel={card.style}
                  confirmationCount={card.confirmationCount}
                  currentBasis={currentBasis}
                />
              ) : (
                <span className="text-[11px] text-studio-quiet">
                  No style/color recorded — cannot anchor a basis
                </span>
              )}
              {card.confirmationCount > 0 && (
                <span className="shrink-0 font-mono text-[9px] tracking-[0.08em] text-[#805617]">
                  {card.confirmationCount} OPEN{" "}
                  {card.confirmationCount === 1 ? "CONFIRMATION" : "CONFIRMATIONS"}
                </span>
              )}
            </div>
          </figure>
        ))}
      </div>

      <Dialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open) setOpenIndex(null);
        }}
      >
        <DialogContent
          className="max-h-[95vh] max-w-[95vw]"
          onKeyDown={(e) => {
            if (cards.length <= 1) return;
            if (e.key === "ArrowLeft") showPrev();
            else if (e.key === "ArrowRight") showNext();
          }}
        >
          <DialogTitle className="sr-only">Concept rendering preview</DialogTitle>
          {active && (
            <>
              <RenderingImage
                src={active.imageUrl}
                alt={`Concept rendering for ${customerName}`}
                wrapperClassName="max-h-[95vh] max-w-[95vw]"
                imgClassName="rounded-lg object-contain shadow-2xl"
                eager
              />
              {active.colorName && (
                <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                  {active.colorName}
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
                  href={active.imageUrl}
                  fileName={active.downloadName}
                />
              </div>
              {cards.length > 1 && openIndex !== null && (
                <>
                  <button
                    type="button"
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition hover:bg-black/80 disabled:hidden"
                    onClick={showPrev}
                    disabled={openIndex === 0}
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
                    disabled={openIndex === cards.length - 1}
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
    </>
  );
}
