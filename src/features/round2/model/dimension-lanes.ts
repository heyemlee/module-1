// Dimension-chain labels collide when neighbouring segments are narrow: a 3/4″
// filler is ~2px wide on the elevation but its label is ~30px, so "3/4″" and
// "1 1/2″" run together. Every dimension has to stay on the drawing, so labels
// are never dropped or merged. Two placement policies live here: labels that
// may slide along their chain until they clear their neighbours
// (layoutDimensionLabels), and labels pinned to a centreline that stack onto
// further rows instead of moving (stackAnchoredLabels).
//
// Used by the proposal elevation and the A-series drawing sheets, which share
// this placement policy so the same wall dimensions the same way on screen and
// on the sheet.

export type DimensionLabel = {
  /** Preferred centre: the midpoint of the segment being dimensioned. */
  center: number;
  text: string;
  /** Drawn width, when the glyphs are narrower than the plain text measures. */
  width?: number;
  /** Earliest dimension row this label may occupy. */
  minimumLane?: number;
};

export type DimensionLabelPlacement = {
  /** Where the label is actually drawn. */
  center: number;
  /** Row index away from the chain; 0 is the chain's own row. */
  lane: number;
  /** Label left its segment midpoint while resolving a collision. */
  shifted: boolean;
};

export type DimensionLabelOptions = {
  fontSize: number;
  /** Horizontal span the labels must stay inside, usually the run. */
  bounds: readonly [number, number];
  /** Clear space between two neighbouring labels. */
  gap?: number;
  /** Rows available including the chain's own; 1 disables spilling. */
  maxLanes?: number;
  /** How far a label may slide before it drops to the next row instead. */
  maxShift?: number;
};

/**
 * Advance width of the mono dimension face as a fraction of the font size.
 * Measured rather than queried so the estimate is identical under SSR, in
 * tests, and in the browser — placement must not depend on font loading.
 */
const MONO_ADVANCE = 0.62;

export function measureDimensionLabel(text: string, fontSize: number): number {
  return text.length * fontSize * MONO_ADVANCE;
}

export function layoutDimensionLabels(
  labels: readonly DimensionLabel[],
  options: DimensionLabelOptions
): DimensionLabelPlacement[] {
  const gap = options.gap ?? 4;
  const maxLanes = Math.max(1, options.maxLanes ?? 2);
  const maxShift = options.maxShift ?? Number.POSITIVE_INFINITY;
  const widths = labels.map(
    (label) => label.width ?? measureDimensionLabel(label.text, options.fontSize)
  );
  const placements: DimensionLabelPlacement[] = labels.map((label) => ({
    center: label.center,
    lane: 0,
    shifted: false
  }));

  let pending = labels.map((_, index) => index);
  for (let lane = 0; lane < maxLanes && pending.length > 0; lane += 1) {
    const lastLane = lane === maxLanes - 1;
    const ready = pending.filter(
      (index) => Math.min(labels[index].minimumLane ?? 0, maxLanes - 1) <= lane
    );
    const deferred = pending.filter((index) => !ready.includes(index));
    if (ready.length === 0) continue;
    const packed = packRow(ready, labels, widths, gap, options.bounds);
    // Alternate crowded labels down instead of sending the whole cluster, so
    // the two rows share the load rather than one staying empty.
    const crowded = lastLane
      ? []
      : ready
          .filter(
            (index) => Math.abs(packed[index] - labels[index].center) > maxShift
          )
          .sort((a, b) => labels[a].center - labels[b].center);
    const demoted = crowded.filter((_, position) => position % 2 === 0);

    // Dropping the crowded labels only ever relieves pressure on this row, so
    // the survivors can be repacked once and committed.
    const kept =
      demoted.length === 0
        ? ready
        : ready.filter((index) => !demoted.includes(index));
    const settled =
      demoted.length === 0
        ? packed
        : packRow(kept, labels, widths, gap, options.bounds);

    for (const index of kept) {
      placements[index] = {
        center: settled[index],
        lane,
        shifted: Math.abs(settled[index] - labels[index].center) > 0.5
      };
    }
    pending = [...deferred, ...demoted];
  }

  return placements;
}

export type AnchoredLabel = {
  /** Centreline the label may not leave — the midpoint of its own part. */
  center: number;
  /** Room the label needs across the chain. */
  width: number;
};

/**
 * Rows for labels that may not slide at all: a number turned on end under a
 * part too narrow to hold it flat has to stay on that part's centreline, so two
 * parts closer together than the label needs cannot share a row and the later
 * one steps out to the next. Returns each label's row, 0 being the innermost.
 */
export function stackAnchoredLabels(
  labels: readonly AnchoredLabel[],
  gap = 4
): number[] {
  const rows: { left: number; right: number }[][] = [];
  const assigned = labels.map(() => 0);
  const ordered = labels
    .map((_, index) => index)
    .sort((a, b) => labels[a].center - labels[b].center);

  for (const index of ordered) {
    const half = labels[index].width / 2 + gap / 2;
    const box = {
      left: labels[index].center - half,
      right: labels[index].center + half
    };
    let row = 0;
    while (
      (rows[row] ?? []).some(
        (taken) => taken.left < box.right && box.left < taken.right
      )
    ) {
      row += 1;
    }
    if (!rows[row]) rows[row] = [];
    rows[row].push(box);
    assigned[index] = row;
  }
  return assigned;
}

/**
 * Places one row of labels as close to their preferred centres as possible
 * without overlapping, by the pool-adjacent-violators method: labels that want
 * to sit on top of each other merge into a block that shares out the shift
 * evenly, so a cramped pair splits left/right instead of one shoving the other.
 */
function packRow(
  indices: readonly number[],
  labels: readonly DimensionLabel[],
  widths: readonly number[],
  gap: number,
  bounds: readonly [number, number]
): Record<number, number> {
  type Block = {
    items: number[];
    /** Each item's centre measured from the block's left edge. */
    offsets: number[];
    width: number;
    /** Σ(preferred centre − offset); the mean is the block's ideal left edge. */
    sum: number;
    left: number;
  };

  const ordered = [...indices].sort(
    (a, b) => labels[a].center - labels[b].center
  );
  const blocks: Block[] = [];

  for (const index of ordered) {
    let block: Block = {
      items: [index],
      offsets: [widths[index] / 2],
      width: widths[index],
      sum: labels[index].center - widths[index] / 2,
      left: labels[index].center - widths[index] / 2
    };
    while (blocks.length > 0) {
      const previous = blocks[blocks.length - 1];
      if (previous.left + previous.width + gap <= block.left) break;
      blocks.pop();
      const shift = previous.width + gap;
      const items = [...previous.items, ...block.items];
      const merged: Block = {
        items,
        offsets: [
          ...previous.offsets,
          ...block.offsets.map((offset) => offset + shift)
        ],
        width: previous.width + gap + block.width,
        sum: previous.sum + (block.sum - block.items.length * shift),
        left: 0
      };
      merged.left = merged.sum / items.length;
      block = merged;
    }
    blocks.push(block);
  }

  // Pull the row inside the bounds. Non-overlap is the hard constraint and the
  // bounds are soft: a row too crowded to fit runs past the right edge rather
  // than stacking text on text.
  const floors: number[] = [];
  let cursor = bounds[0];
  for (const [order, block] of blocks.entries()) {
    floors[order] = cursor;
    block.left = Math.max(block.left, cursor);
    cursor = block.left + block.width + gap;
  }
  let ceiling = bounds[1];
  for (let order = blocks.length - 1; order >= 0; order -= 1) {
    const block = blocks[order];
    block.left = Math.max(
      floors[order],
      Math.min(block.left, ceiling - block.width)
    );
    ceiling = block.left - gap;
  }

  const centers: Record<number, number> = {};
  for (const block of blocks) {
    for (const [position, item] of block.items.entries()) {
      centers[item] = block.left + block.offsets[position];
    }
  }
  return centers;
}
