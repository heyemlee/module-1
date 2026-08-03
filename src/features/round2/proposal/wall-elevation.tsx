"use client";

import { useId, useState, type Dispatch } from "react";
import { cn } from "@/lib/utils";
import {
  findWall,
  formatSixteenths,
  sinkCenteringOffsetSixteenths,
  type CabinetKind,
  type FrontAccessory,
  type Round2FixedPoint,
  type Round2HeightProfile,
  type Round2Model,
  type Round2Wall,
  type WallId,
  type WallSegment
} from "../model/round2-model";
import {
  resolveSegmentRole,
  SEGMENT_ROLE_TAGS
} from "../model/segment-role";
import { ApplianceGlyph, WindowGlyph } from "../appliance-glyphs";
import { CABINET_STANDARDS } from "../model/cabinet-standards";
import {
  previewMerge,
  standardWidthOptionsSixteenths
} from "../model/adjustments";
import {
  layoutDimensionLabels,
  stackAnchoredLabels,
  type DimensionLabelPlacement
} from "../model/dimension-lanes";
import {
  dimensionBackdropBand,
  dimensionLabelSpan,
  dimensionLabelWidth,
  dimensionParts,
  DraftDimensionValue as DimensionValue
} from "./drafting-dimension";
import {
  ACCESSORY_LABELS,
  describeFront,
  resolveSegmentFront,
  type ResolvedFront
} from "../model/front";
import {
  fridgeAboveHeightIntentKey,
  fridgeAboveIntentKey,
  fridgeSidesIntentKey,
  type CornerStrategy,
  type FridgeAboveStrategy,
  type FridgeSideStrategy,
  type Round2DesignIntent
} from "../model/design-intent";
import {
  fridgeAboveHeightForSegment,
  fridgeAboveHeightSixteenths,
  FRIDGE_ABOVE_HEIGHT_OPTIONS,
  isFridgeAboveUnit,
  resolveFridgeAboveHeights
} from "../model/fridge-surround";
import { resolveSinkUpperHeights } from "../model/sink-upper";
import { deriveCorners, type CornerEnd } from "../model/corners";
import type {
  Round2AbsorbedChange,
  Round2PrototypeAction
} from "../round2-types";
import { InchField } from "../measurement/inch-field";

// Elevation canvas: the floor line and the ceiling span are fixed in pixels;
// everything vertical in between scales from the model height profile.
// Use more of the taller sheet while preserving the outer height-chain and
// label gutters, so the drawing grows with the proposal surface.
const RUN_LEFT = 40;
const RUN_WIDTH = 560;
const FLOOR_Y = 394;
// Keep the dimension chains inside the viewport with clear breathing room at
// both edges; the lower corner breakdown row otherwise sits too close to crop.
const ELEVATION_VIEWBOX_LEFT = -125;
const ELEVATION_VIEWBOX_TOP = -36;
const ELEVATION_VIEWBOX_WIDTH = 780;
// Four rows of stacked narrow-board dimensions need 30px more lower gutter
// than the original sheet; otherwise the last row is forced sideways.
const ELEVATION_VIEWBOX_HEIGHT = 560;
const CEILING_Y = 82;
// Keep every value horizontally locked to the board it measures. A number its
// own board cannot hold steps straight out onto its own row, upright and plumb
// over that board, rather than sliding along the chain past its neighbours.
// The clearance has to cover the padding each number's white backdrop adds
// around its glyphs, so a stacked number never rubs out the one beside it.
const STACKED_LABEL_GAP = 4;
// Clear of the numbers sitting on the chain rule itself.
const STACKED_LABEL_LEAD = 10;
const DIMENSION_LABEL_FIT_PADDING = 6;
const RUN_CHAIN_LABEL_OVERHANG = 28;
const DIMENSION_COLOR = "#079ca5";
const DIMENSION_FONT_SIZE = 11;
const DIMENSION_STROKE_WIDTH = 2;
// Hovering either a cabinet or its dimension lights up both, and a selected
// cabinet keeps its dimension lit. The classes live on the chain because the
// label and the cabinet share one <g>.
const PAIR_HIGHLIGHT_LINE =
  "transition-[stroke,stroke-width] duration-100 group-hover:[stroke:#046a70] group-hover:[stroke-width:3] group-data-[selected=true]:[stroke:#046a70] group-data-[selected=true]:[stroke-width:3]";
const PAIR_HIGHLIGHT_TEXT =
  "underline-offset-2 transition-[fill] duration-100 group-hover:underline group-hover:[fill:#046a70] group-data-[selected=true]:underline group-data-[selected=true]:[fill:#046a70]";
// The cabinet body picks up the same accent so hovering the number marks the
// box too. Selection keeps its own heavier teal outline, set on the element.
const PAIR_HIGHLIGHT_BODY =
  "transition-[stroke] duration-100 group-hover:[stroke:#046a70]";
const WIDTH_CHAIN_EXTENSION_LENGTH = 8;
// In an ordinary run the overall row stays close to the sectional chain. When
// narrow-board labels need extra stacked rows, it moves outward just enough to
// preserve their clearance instead of leaving the large gap on every sheet.
const COMPACT_OVERALL_DIMENSION_GUIDE_Y = 12;
const OVERALL_LABEL_CLEARANCE = 10;
// Three upper dimension rows occupy y=11, 42, and 64. Keeping this row
// independent of the ceiling lets the full elevation sit lower without
// pushing a dimension chain through the ceiling datum.
const UPPER_CHAIN_LABEL_Y = 42;
const BASE_CHAIN_LABEL_Y = 64;
const CABINET_FILL = "#ffffff";
const CABINET_FACE_STROKE = "#1d1d1b";
// Keep every vertical dimension outside the cabinet run. The room overall
// height is always the outermost left lane; tall-unit and profile dimensions
// step inward toward the drawing.
const PROFILE_HEIGHT_CHAIN_X = 4;
const TALL_HEIGHT_CHAIN_X = -12;
const ROOM_HEIGHT_CHAIN_X = -24;
const TALL_HEIGHT_LANE_STEP = 18;

function roomHeightChainX(tallUnitCount: number): number {
  // Tall dimensions fan outward when a wall contains more than one tower.
  // Move the room total farther out by the same spacing so it remains the
  // leftmost vertical dimension in every configuration.
  return Math.min(
    ROOM_HEIGHT_CHAIN_X,
    TALL_HEIGHT_CHAIN_X - tallUnitCount * TALL_HEIGHT_LANE_STEP - 6
  );
}

function widthChainLabelY(
  labelSide: "above" | "below",
  tier: WallSegment["tier"]
): number {
  return widthChainGuideY(labelSide, tier);
}

/** The rule a tier's width chain is drawn on, with its numbers centred on it. */
function widthChainGuideY(
  labelSide: "above" | "below",
  tier: WallSegment["tier"]
): number {
  return labelSide === "below"
    ? FLOOR_Y + 12
    : tier === "upper"
      ? UPPER_CHAIN_LABEL_Y + 5
      : BASE_CHAIN_LABEL_Y + 5;
}

/**
 * A stacked number stands upright outside the numbers on the chain rule, still
 * centred on its own board. `offset` is the clear distance from the rule to the
 * near edge of the number, so rows already standing between it and the chain
 * push it further out without ever moving it sideways.
 */
function stackedChainLabelY(
  labelSide: "above" | "below",
  tier: WallSegment["tier"],
  offset: number,
  band: { top: number; height: number }
): number {
  const guideY = widthChainGuideY(labelSide, tier);
  return labelSide === "below"
    ? guideY + offset - band.top
    : guideY - offset - band.height - band.top;
}

/** Chain rule for one segment, closed by a witness line at each board edge. */
function widthChainGuidePath(
  x: number,
  width: number,
  labelSide: "above" | "below",
  tier: WallSegment["tier"]
): string {
  const guideY = widthChainGuideY(labelSide, tier);
  const witnessY =
    guideY +
    (labelSide === "above"
      ? WIDTH_CHAIN_EXTENSION_LENGTH
      : -WIDTH_CHAIN_EXTENSION_LENGTH);
  return `M ${x} ${guideY} V ${witnessY} M ${x} ${guideY} H ${x + width} M ${x + width} ${witnessY} V ${guideY}`;
}

/**
 * One width-chain number. It sits on the chain rule when its own board is wide
 * enough to hold it, and otherwise steps out onto its own row directly below
 * that board so the reader can tell at a glance which board it reads.
 */
function ChainWidthLabel({
  segment,
  segmentCenter,
  placement,
  labelSide
}: {
  segment: WallSegment;
  segmentCenter: number;
  placement: ChainLabelPlacement | undefined;
  labelSide: "above" | "below";
}) {
  const center = placement?.center ?? segmentCenter;
  const stacked = placement?.stacked ?? false;
  const offset = placement?.offset ?? STACKED_LABEL_LEAD;
  const guideY = widthChainGuideY(labelSide, segment.tier);
  const labelY = stacked
    ? stackedChainLabelY(
        labelSide,
        segment.tier,
        offset,
        dimensionBackdropBand(dimensionParts(segment.widthSixteenths))
      )
    : widthChainLabelY(labelSide, segment.tier);

  return (
    <>
      {/* A number standing off the chain rule needs its centreline drawn in for
          the eye to carry it back to its own board — plumb, never at an angle. */}
      {stacked && (
        <line
          data-chain-leader={segment.id}
          x1={center}
          y1={guideY}
          x2={center}
          y2={guideY + (labelSide === "below" ? offset : -offset)}
          stroke={DIMENSION_COLOR}
          strokeWidth="0.75"
          className={PAIR_HIGHLIGHT_LINE}
        />
      )}
      <DimensionValue
        value={segment.widthSixteenths}
        x={center}
        y={labelY}
        attribute="data-chain-label"
        id={segment.id}
        className={PAIR_HIGHLIGHT_TEXT}
      />
    </>
  );
}

/** Midpoint of each segment along the run, following the mirrored draw order. */
function runSegmentCenters(
  widthsPx: readonly number[],
  mirrored: boolean
): number[] {
  const centers: number[] = [];
  let cursor = 0;
  for (const width of widthsPx) {
    const x = mirrored
      ? RUN_LEFT + RUN_WIDTH - cursor - width
      : RUN_LEFT + cursor;
    centers.push(x + width / 2);
    cursor += width;
  }
  return centers;
}

/** A gap standing in for the adjacent run's side profile crossing this wall. */
function resolveCornerReturn(
  segment: WallSegment,
  index: number,
  segmentCount: number,
  cornerReturns?: Map<string, CornerReturnTarget>
): CornerReturnTarget | null {
  if (segment.kind !== "gap" || !segment.sourceCornerId) return null;
  return (
    cornerReturns?.get(segment.sourceCornerId) ??
    fallbackCornerReturn(index, segmentCount)
  );
}

/** This wall carries the corner cabinet itself, cut by the adjacent run. */
function resolveHostedCornerEnd(
  segment: WallSegment,
  cornerHostSides?: Map<string, CornerEnd>
): CornerEnd | null {
  if (
    segment.kind !== "cabinet" ||
    segment.cabinetKind !== "corner" ||
    !segment.sourceCornerId
  ) {
    return null;
  }
  return cornerHostSides?.get(segment.sourceCornerId) ?? null;
}

/** The upper unit sitting over a hosted corner picks up the same breakdown. */
function resolveUpperCornerEnd(
  segment: WallSegment,
  index: number,
  segmentCount: number,
  cornerHostSides?: Map<string, CornerEnd>
): CornerEnd | null {
  if (segment.tier !== "upper" || segment.kind !== "cabinet") return null;
  return (
    [...(cornerHostSides?.values() ?? [])].find(
      (end) =>
        (end === "start" && index === 0) ||
        (end === "end" && index === segmentCount - 1)
    ) ?? null
  );
}

/**
 * Which side of a segment the adjacent run crosses, or null when the segment
 * carries no breakdown chain. Both the placement pass and the render read this,
 * so the row that gets packed is exactly the row that gets drawn.
 */
function cornerBreakdownSide(
  segment: WallSegment,
  index: number,
  segmentCount: number,
  mirrored: boolean,
  cornerReturns?: Map<string, CornerReturnTarget>,
  cornerHostSides?: Map<string, CornerEnd>
): boolean | null {
  const end =
    resolveCornerReturn(segment, index, segmentCount, cornerReturns)?.side ??
    resolveHostedCornerEnd(segment, cornerHostSides) ??
    resolveUpperCornerEnd(segment, index, segmentCount, cornerHostSides);
  if (end == null) return null;
  return mirrored ? end === "end" : end === "start";
}

/** Gaps stay undimensioned unless they are a corner return or a wanted gap. */
function carriesChainLabel(segment: WallSegment): boolean {
  if (segment.kind !== "gap") return true;
  return segment.sourceCornerId != null || segment.intentionalGap === true;
}

/** A board too narrow to carry its own number between its witness lines. */
function chainLabelIsStacked(segment: WallSegment, widthPx: number): boolean {
  return (
    widthPx <
    dimensionLabelWidth(segment.widthSixteenths) + DIMENSION_LABEL_FIT_PADDING
  );
}

type ChainLabelPlacement = {
  /** Where the number is drawn along the chain. */
  center: number;
  /** Clear distance from the chain rule to the number; 0 when it sits on it. */
  offset: number;
  /** Number stepped off the rule because its board is too narrow to hold it. */
  stacked: boolean;
};

/**
 * How far a chain may stack numbers off its rule before it runs off the sheet:
 * the overall dimension bounds the chain above the run, the sheet edge the one
 * below it. The corner breakdown row shares that lower gutter and gives way.
 */
function stackedLabelBudget(
  labelSide: "above" | "below",
  tier: WallSegment["tier"]
): number {
  const chainY = widthChainGuideY(labelSide, tier);
  return labelSide === "above"
    ? chainY -
        (ELEVATION_VIEWBOX_TOP + OVERALL_LABEL_CLEARANCE + STACKED_LABEL_GAP)
    : ELEVATION_VIEWBOX_TOP +
        ELEVATION_VIEWBOX_HEIGHT -
        STACKED_LABEL_GAP -
        chainY;
}

/**
 * Chain labels for one run, placed as a whole. Numbers are grouped by the chain
 * they belong to (upper and base are separate rules) and each chain is split in
 * two: numbers their own board can hold sit on the rule, where the board itself
 * keeps them apart, and the rest step out onto their own row, still upright and
 * still plumb over the board they measure.
 */
function placeRunChainLabels(
  segments: readonly WallSegment[],
  centers: readonly number[],
  widthsPx: readonly number[],
  carries: readonly boolean[],
  labelSide: "above" | "below"
): Map<string, ChainLabelPlacement> {
  const chains = new Map<number, number[]>();
  segments.forEach((segment, index) => {
    if (!carries[index]) return;
    const chain = widthChainLabelY(labelSide, segment.tier);
    const indices = chains.get(chain);
    if (indices) indices.push(index);
    else chains.set(chain, [index]);
  });

  const bounds: [number, number] = [
    RUN_LEFT - RUN_CHAIN_LABEL_OVERHANG,
    RUN_LEFT + RUN_WIDTH + RUN_CHAIN_LABEL_OVERHANG
  ];
  const placed = new Map<string, ChainLabelPlacement>();
  for (const indices of chains.values()) {
    const stacked = indices.filter((index) =>
      chainLabelIsStacked(segments[index], widthsPx[index])
    );
    const onRule = indices.filter(
      (index) => !chainLabelIsStacked(segments[index], widthsPx[index])
    );

    const rulePlacements = layoutDimensionLabels(
      onRule.map((index) => ({
        center: centers[index],
        text: formatSixteenths(segments[index].widthSixteenths),
        width: dimensionLabelWidth(segments[index].widthSixteenths)
      })),
      { fontSize: DIMENSION_FONT_SIZE, bounds, maxLanes: 1 }
    );
    onRule.forEach((index, position) => {
      placed.set(segments[index].id, {
        center: rulePlacements[position].center,
        offset: 0,
        stacked: false
      });
    });

    if (stacked.length === 0) continue;
    const spans = stacked.map((index) =>
      dimensionLabelSpan(segments[index].widthSixteenths)
    );
    const depths = stacked.map(
      (index) =>
        dimensionBackdropBand(dimensionParts(segments[index].widthSixteenths))
          .height
    );
    const rows = stackAnchoredLabels(
      stacked.map((index, position) => ({
        center: centers[index],
        width: spans[position]
      })),
      STACKED_LABEL_GAP
    );
    const offsets = stackedRowOffsets(rows, depths);
    const budget = stackedLabelBudget(labelSide, segments[stacked[0]].tier);
    // The last row that still fits the sheet takes everything that would have
    // stacked past it; only there, where nothing else is left, may a number
    // slide off its board rather than be lost.
    const lastRow = offsets.reduce(
      (last, offset, row) =>
        offset + rowDepth(rows, depths, row) <= budget ? row : last,
      0
    );
    const crowded = stacked
      .map((_, position) => position)
      .filter((position) => rows[position] >= lastRow);
    const slid = layoutDimensionLabels(
      crowded.map((position) => ({
        center: centers[stacked[position]],
        text: formatSixteenths(segments[stacked[position]].widthSixteenths),
        width: spans[position]
      })),
      { fontSize: DIMENSION_FONT_SIZE, bounds, gap: STACKED_LABEL_GAP, maxLanes: 1 }
    );

    stacked.forEach((index, position) => {
      const slidAt = crowded.indexOf(position);
      placed.set(segments[index].id, {
        center: slidAt >= 0 ? slid[slidAt].center : centers[index],
        offset: offsets[Math.min(rows[position], lastRow)],
        stacked: true
      });
    });
  }
  return placed;
}

/** How far past its chain rule a run's deepest number reaches. */
function stackedChainReach(
  segments: readonly WallSegment[],
  placements: ReadonlyMap<string, ChainLabelPlacement>
): number {
  return segments.reduce((reach, segment) => {
    const placement = placements.get(segment.id);
    if (!placement?.stacked) return reach;
    const band = dimensionBackdropBand(dimensionParts(segment.widthSixteenths));
    return Math.max(reach, placement.offset + band.height);
  }, 0);
}

/**
 * Keep the overall width close to the main upper chain unless stacked narrow
 * labels occupy that space. In a crowded run it retreats toward the sheet edge
 * while the numbers remain vertically aligned with their own boards.
 */
function overallDimensionGuideY(
  segments: readonly WallSegment[],
  total: number,
  mirrored: boolean
): number {
  if (segments.length === 0 || total <= 0) {
    return COMPACT_OVERALL_DIMENSION_GUIDE_Y;
  }
  const widths = segments.map(
    (segment) => (Math.max(0, segment.widthSixteenths) / total) * RUN_WIDTH
  );
  const centers = runSegmentCenters(widths, mirrored);
  const placements = placeRunChainLabels(
    segments,
    centers,
    widths,
    segments.map(carriesChainLabel),
    "above"
  );
  const stackedReach = stackedChainReach(segments, placements);
  const chainY = widthChainGuideY("above", "upper");

  return Math.max(
    ELEVATION_VIEWBOX_TOP + OVERALL_LABEL_CLEARANCE,
    Math.min(
      COMPACT_OVERALL_DIMENSION_GUIDE_Y,
      chainY - stackedReach - OVERALL_LABEL_CLEARANCE
    )
  );
}

function rowDepth(
  rows: readonly number[],
  depths: readonly number[],
  row: number
): number {
  return rows.reduce(
    (deepest, assigned, position) =>
      assigned === row ? Math.max(deepest, depths[position]) : deepest,
    0
  );
}

/** Each row is only as deep as the tallest number standing in it. */
function stackedRowOffsets(
  rows: readonly number[],
  depths: readonly number[]
): number[] {
  const offsets: number[] = [];
  let cursor = STACKED_LABEL_LEAD;
  for (let row = 0; row <= Math.max(...rows); row += 1) {
    offsets[row] = cursor;
    cursor += rowDepth(rows, depths, row) + STACKED_LABEL_GAP;
  }
  return offsets;
}

// Corner returns follow NKBA section conventions: sectioned side profile in
// amber hatch, hidden carcass in dashed gray, counter cut in dark poché, and
// a parenthesized depth reference kept out of the teal cabinet chain.
const CORNER_SECTION_COLOR = "#1d1d1b";
const CORNER_RETURN_FILL = "transparent";
const HIDDEN_LINE_COLOR = "#1d1d1b";
const COUNTER_SECTION_FILL = "#1d1d1b";
const COUNTER_THICKNESS_SIXTEENTHS = 24; // 1.5″
// The counter slab drawn over the straight base run: a light poché band with
// a solid ink surface line and a small end overhang, matching the reference
// section conventions in the black/white theme.
const COUNTER_SLAB_FILL = CABINET_FILL;
const COUNTER_SLAB_STROKE = "#1d1d1b";
const COUNTER_END_OVERHANG_PX = 3;
const TOE_KICK_HEIGHT_SIXTEENTHS = 72; // 4.5″
const TOE_KICK_DEPTH_SIXTEENTHS = 48; // 3″

/** Where a secondary-wall corner return jumps to: the hosting cabinet. */
type CornerReturnTarget = {
  side: CornerEnd;
};

type VerticalLayout = {
  scale: number;
  /** Finished counter top (datum for backsplash + counter slab). */
  baseTop: number;
  /** Top of the base cabinet body — the counter slab fills baseTop→here. */
  baseBodyTop: number;
  upperTop: number;
  upperBottom: number;
  profile: Round2HeightProfile;
};

function verticalLayout(model: Round2Model | null): VerticalLayout {
  const vertical = CABINET_STANDARDS.vertical;
  const profile = model?.heightProfile ?? {
    counterSixteenths: vertical.finishedCounterHeightSixteenths,
    backsplashSixteenths: vertical.backsplashMinSixteenths,
    upperHeightSixteenths:
      CABINET_STANDARDS.upper.standardHeightsSixteenths[1],
    mouldingSixteenths: vertical.flatMoulding.preferredSixteenths
  };
  const ceiling = model?.ceilingHeightSixteenths ?? 96 * 16;
  const scale = (FLOOR_Y - CEILING_Y) / Math.max(1, ceiling);
  const baseTop = FLOOR_Y - profile.counterSixteenths * scale;
  const baseBodyTop = baseTop + counterThicknessSixteenths(profile) * scale;
  const upperBottom = baseTop - profile.backsplashSixteenths * scale;
  const upperTop = upperBottom - profile.upperHeightSixteenths * scale;
  return { scale, baseTop, baseBodyTop, upperTop, upperBottom, profile };
}

/** Countertop thickness = finished counter height minus the base body height. */
function counterThicknessSixteenths(profile: Round2HeightProfile): number {
  return Math.max(
    0,
    profile.counterSixteenths - CABINET_STANDARDS.base.heightSixteenths
  );
}

/**
 * The dimensioned base cabinet height is the 34 1/2″ body. The counter slab
 * above it is drawn but deliberately carries no dimension of its own.
 */
function baseBodyHeightSixteenths(profile: Round2HeightProfile): number {
  return profile.counterSixteenths - counterThicknessSixteenths(profile);
}

/** A base run segment carries a counter unless it is tall or a freestanding range. */
function hasCountertop(
  segment: WallSegment,
  fixedPoints: Round2FixedPoint[]
): boolean {
  if (segment.tier !== "base") return false;
  if (segment.cabinetKind === "tall") return false;
  // A full-height side panel beside a tall unit breaks the counter; a
  // tier-height panel (run end, dishwasher side) sits under it like a cabinet.
  if (segment.kind === "panel") return segment.panelSpan === "tier";
  if (segment.kind === "opening") return false;
  // A sourced corner-return reservation is encoded as a gap because the
  // cabinet belongs to the adjacent wall, but its countertop still crosses
  // this wall. Intentional/open gaps remain genuine counter breaks.
  if (segment.kind === "gap") return Boolean(segment.sourceCornerId);
  return resolveSegmentRole(segment, { fixedPoints }) !== "range";
}

/**
 * The counter line runs across every counter-topped segment, while the shallow
 * slab/shadow is reserved for ordinary base cabinets. Corner units and
 * finished panels are shown with the clean top line only, so their section or
 * hatch notation is never darkened by a second horizontal band.
 */
function hasCountertopSlabShadow(
  segment: WallSegment,
  fixedPoints: Round2FixedPoint[]
): boolean {
  if (!hasCountertop(segment, fixedPoints)) return false;
  if (segment.kind === "panel" || segment.cabinetKind === "corner") {
    return false;
  }
  return !(segment.kind === "gap" && segment.sourceCornerId);
}

function segmentBox(
  segment: WallSegment,
  layout: VerticalLayout,
  fridgeAboveHeights: ReadonlyMap<string, number> = EMPTY_ABOVE_HEIGHTS,
  sinkUpperHeights: ReadonlyMap<string, number> = EMPTY_ABOVE_HEIGHTS
): { y: number; height: number } {
  const aboveHeight = fridgeAboveHeightForSegment(segment, fridgeAboveHeights);
  // The wall cabinet / panel above a fridge hangs from the ceiling-aligned
  // upper top at its own (usually shorter) height, and the fridge box is capped
  // just beneath it — the base run paints after the upper run, so a full-height
  // fridge would otherwise cover the unit above it.
  if (aboveHeight != null) {
    if (isFridgeAboveUnit(segment, fridgeAboveHeights)) {
      return { y: layout.upperTop, height: aboveHeight * layout.scale };
    }
    if (segment.cabinetKind === "tall") {
      const top = layout.upperTop + aboveHeight * layout.scale;
      return { y: top, height: FLOOR_Y - top };
    }
  }
  // The module over a windowless sink stays top-aligned with the upper run
  // and hangs at its own shorter height, leaving the 24–30″ clearance below.
  const sinkUpperHeight = sinkUpperHeights.get(segment.id);
  if (sinkUpperHeight != null) {
    return { y: layout.upperTop, height: sinkUpperHeight * layout.scale };
  }
  if (segment.tier === "upper") {
    return { y: layout.upperTop, height: layout.upperBottom - layout.upperTop };
  }
  // A full-height base panel flanks a tall unit, so it runs floor to cabinet
  // top like one; a tier-height panel matches the base body below the counter.
  if (
    segment.tier === "full" ||
    segment.cabinetKind === "tall" ||
    (segment.kind === "panel" && segment.panelSpan !== "tier")
  ) {
    return { y: layout.upperTop, height: FLOOR_Y - layout.upperTop };
  }
  return { y: layout.baseTop, height: FLOOR_Y - layout.baseTop };
}

const EMPTY_ABOVE_HEIGHTS: ReadonlyMap<string, number> = new Map();


function segmentFill(segment: WallSegment) {
  return CABINET_FILL;
}

export function WallElevation({
  wallId,
  model,
  designIntent,
  selectedObjectId,
  lastAbsorbed = null,
  canEdit = false,
  onSelect,
  onSelectWall,
  dispatch
}: {
  wallId: WallId | null;
  model: Round2Model | null;
  designIntent?: Round2DesignIntent;
  selectedObjectId: string | null;
  lastAbsorbed?: Round2AbsorbedChange | null;
  canEdit?: boolean;
  onSelect: (id: string, wall: WallId) => void;
  onSelectWall?: (wall: WallId) => void;
  dispatch?: Dispatch<Round2PrototypeAction>;
}) {
  const wall = findWall(model, wallId);
  const [editingId, setEditingId] = useState<string | null>(selectedObjectId);
  const total =
    wall?.lengthSixteenths ??
    wall?.segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0) ??
    1;
  const layout = verticalLayout(model);
  const upper = wall?.segments.filter((segment) => segment.tier === "upper") ?? [];
  const base = wall?.segments.filter((segment) => segment.tier !== "upper") ?? [];
  const fridgeAboveHeights = resolveFridgeAboveHeights(
    wall?.segments ?? [],
    designIntent,
    layout.profile
  );
  const sinkUpperHeights = resolveSinkUpperHeights(
    wall?.segments ?? [],
    wall?.fixedPoints ?? [],
    layout.profile
  );
  const mirrored = isMirroredElevationWall(wall);
  const overallGuideY = overallDimensionGuideY(upper, total, mirrored);
  const editingSegment =
    wall?.segments.find((segment) => segment.id === editingId) ?? null;
  const cornerReturns = buildCornerReturnTargets(model, wall);
  const cornerEnds = insideCornerEnds(model, wall);
  const cornerHostSides = buildCornerHostSides(model, wall);
  const hatchPatternId = `${useId().replaceAll(":", "")}-corner-hatch`;
  const overflowHatchPatternId = `${useId().replaceAll(":", "")}-overflow-hatch`;
  const openEditor = (segment: WallSegment) => {
    onSelect(segment.id, wall?.id ?? "");
    if (!canEdit || !dispatch) return;
    if (!canOpenSegmentEditor(segment)) return;
    setEditingId(segment.id === editingId ? null : segment.id);
  };

  return (
    <div className="relative flex h-full min-h-[440px] flex-col overflow-hidden rounded-[18px] border border-studio-line bg-white shadow-[0_18px_42px_-30px_rgba(20,20,26,0.28)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[68px] opacity-100 [background-image:linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div
        data-elevation-layer="header"
        className="relative z-10 flex items-center justify-between border-b border-studio-line/40 bg-white px-4 py-3"
      >
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-black/45">
            ELEVATION · PRIMARY EDITOR
          </p>
          <div className="mt-1.5 flex items-center gap-1 rounded-[8px] border border-studio-line/40 bg-white p-0.5 shadow-sm">
            {(model?.walls ?? []).map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={wallId === w.id}
                onClick={() => {
                  setEditingId(null);
                  onSelectWall?.(w.id);
                }}
                className={cn(
                  "flex h-7 px-3 items-center justify-center rounded-[6px] font-mono text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-studio-action",
                  wallId === w.id
                    ? "bg-studio-ink text-white"
                    : "text-black/60 hover:bg-black/5 hover:text-studio-ink"
                )}
              >
                Wall {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <svg
        viewBox={`${ELEVATION_VIEWBOX_LEFT} ${ELEVATION_VIEWBOX_TOP} ${ELEVATION_VIEWBOX_WIDTH} ${ELEVATION_VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={wall ? `Wall ${wall.label} cabinet elevation` : "Cabinet elevation"}
        className="relative z-10 min-h-0 w-full flex-1"
      >
        <g data-elevation-layer="dimensions" stroke={DIMENSION_COLOR} fill={DIMENSION_COLOR} fontFamily="var(--studio-mono)">
          <path
            data-chain-guide="overall"
            d={`M ${RUN_LEFT} ${overallGuideY - WIDTH_CHAIN_EXTENSION_LENGTH} V ${overallGuideY + WIDTH_CHAIN_EXTENSION_LENGTH} M ${RUN_LEFT + RUN_WIDTH} ${overallGuideY - WIDTH_CHAIN_EXTENSION_LENGTH} V ${overallGuideY + WIDTH_CHAIN_EXTENSION_LENGTH} M ${RUN_LEFT} ${overallGuideY} H ${RUN_LEFT + RUN_WIDTH}`}
            strokeWidth={DIMENSION_STROKE_WIDTH}
          />
          <DimensionValue
            value={wall?.lengthSixteenths}
            x={RUN_LEFT + RUN_WIDTH / 2}
            y={overallGuideY}
            attribute="data-chain-label"
            id="overall"
          />
          <HeightChain
            model={model}
            layout={layout}
            tallUnitCount={base.filter((segment) => segment.cabinetKind === "tall").length}
          />
        </g>

        <defs>
          <pattern
            id={hatchPatternId}
            width="7"
            height="7"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="7" height="7" fill={CORNER_RETURN_FILL} />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke={CORNER_SECTION_COLOR}
              strokeWidth="1.1"
              strokeOpacity="0.65"
            />
          </pattern>
          <pattern
            id={overflowHatchPatternId}
            width="8"
            height="8"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="8" fill="#fff0ef" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#d52228" strokeWidth="1.2" strokeOpacity="0.55" />
          </pattern>
        </defs>
        <line x1={RUN_LEFT} y1={FLOOR_Y} x2={RUN_LEFT + RUN_WIDTH} y2={FLOOR_Y} stroke="#292929" strokeWidth="2" />
        <line
          x1={RUN_LEFT}
          y1={CEILING_Y}
          x2={RUN_LEFT + RUN_WIDTH}
          y2={CEILING_Y}
          stroke="#292929"
          strokeWidth="1"
          strokeDasharray="7 5"
        />
        {wall &&
          cornerEnds.map((end) => {
            const atLeft = mirrored ? end === "end" : end === "start";
            const x = atLeft ? RUN_LEFT : RUN_LEFT + RUN_WIDTH;
            return (
              <line
                key={end}
                data-elevation-layer="inside-corner"
                x1={x}
                y1={CEILING_Y - 6}
                x2={x}
                y2={FLOOR_Y + 6}
                stroke="#292929"
                strokeWidth="4"
              />
            );
          })}
        {wall ? (
          <>
            <ElevationRun
              fixedPoints={wall.fixedPoints}
              segments={upper}
              total={total}
              layout={layout}
              designIntent={designIntent}
              labelSide="above"
              selectedObjectId={selectedObjectId}
              lastAbsorbed={lastAbsorbed}
              mirrored={mirrored}
              cornerReturns={cornerReturns}
              cornerHostSides={cornerHostSides}
              hatchPatternId={hatchPatternId}
              fridgeAboveHeights={fridgeAboveHeights}
              sinkUpperHeights={sinkUpperHeights}
              onActivate={openEditor}
            />
            <ElevationRun
              fixedPoints={wall.fixedPoints}
              segments={base}
              total={total}
              layout={layout}
              designIntent={designIntent}
              labelSide="below"
              selectedObjectId={selectedObjectId}
              lastAbsorbed={lastAbsorbed}
              mirrored={mirrored}
              cornerReturns={cornerReturns}
              cornerHostSides={cornerHostSides}
              hatchPatternId={hatchPatternId}
              fridgeAboveHeights={fridgeAboveHeights}
              onActivate={openEditor}
            />
            {canEdit && (
              <>
                <WallOverflowWarning
                  tier="upper"
                  segments={upper}
                  wallLengthSixteenths={wall.lengthSixteenths}
                  total={total}
                  mirrored={mirrored}
                  y={layout.upperTop}
                  height={layout.upperBottom - layout.upperTop}
                  hatchPatternId={overflowHatchPatternId}
                />
                <WallOverflowWarning
                  tier="base"
                  segments={base}
                  wallLengthSixteenths={wall.lengthSixteenths}
                  total={total}
                  mirrored={mirrored}
                  y={layout.baseTop}
                  height={FLOOR_Y - layout.baseTop}
                  hatchPatternId={overflowHatchPatternId}
                />
              </>
            )}
            <CounterBand
              fixedPoints={wall.fixedPoints}
              base={base}
              total={total}
              layout={layout}
              mirrored={mirrored}
            />
            {[...cornerHostSides.entries()].map(([cornerId, end]) => {
              const hostsCorner = wall.segments.some(
                (segment) =>
                  segment.sourceCornerId === cornerId &&
                  segment.kind === "cabinet"
              );
              if (!hostsCorner) return null;
              return (
                <CornerSideProfile
                  key={cornerId}
                  atLeft={mirrored ? end === "end" : end === "start"}
                  layout={layout}
                  pxPerSixteenth={RUN_WIDTH / total}
                  hatchPatternId={hatchPatternId}
                />
              );
            })}
            <g stroke={DIMENSION_COLOR} fill={DIMENSION_COLOR} fontFamily="var(--studio-mono)">
              <TallUnitHeights
                base={base}
                total={total}
                layout={layout}
                fridgeAboveHeights={fridgeAboveHeights}
              />
              <SinkUpperHeights
                upper={upper}
                total={total}
                layout={layout}
                mirrored={mirrored}
                sinkUpperHeights={sinkUpperHeights}
              />
            </g>
          </>
        ) : (
          <text
            x="320"
            y="198"
            textAnchor="middle"
            fontFamily="var(--studio-mono)"
            fontSize="12"
            fill="#8b8b85"
          >
            SUBMIT MEASUREMENTS TO AUTOFILL
          </text>
        )}
      </svg>

      {canEdit &&
        dispatch &&
        wall &&
        editingSegment &&
        canOpenSegmentEditor(editingSegment) && (
        <SegmentEditorCard
          segment={editingSegment}
          wall={wall}
          designIntent={designIntent}
          heightProfile={layout.profile}
          dispatch={dispatch}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function resolveRunOverflow(
  segments: readonly WallSegment[],
  wallLengthSixteenths: number | null | undefined
): number {
  if (wallLengthSixteenths == null) return 0;
  return Math.max(
    0,
    segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0) -
      wallLengthSixteenths
  );
}

function WallOverflowWarning({
  tier,
  segments,
  wallLengthSixteenths,
  total,
  mirrored,
  y,
  height,
  hatchPatternId
}: {
  tier: "upper" | "base";
  segments: readonly WallSegment[];
  wallLengthSixteenths: number | null | undefined;
  total: number;
  mirrored: boolean;
  y: number;
  height: number;
  hatchPatternId: string;
}) {
  const overflowSixteenths = resolveRunOverflow(segments, wallLengthSixteenths);
  if (overflowSixteenths === 0) return null;

  const overflowPx = (overflowSixteenths / total) * RUN_WIDTH;
  const wallEndX = mirrored ? RUN_LEFT : RUN_LEFT + RUN_WIDTH;
  const hatchX = mirrored ? wallEndX - overflowPx : wallEndX;
  const labelX = mirrored ? hatchX : wallEndX + overflowPx;

  return (
    <g
      data-elevation-layer="wall-overflow"
      data-overflow-tier={tier}
      data-overflow-sixteenths={overflowSixteenths}
      pointerEvents="none"
    >
      <rect x={hatchX} y={y} width={overflowPx} height={height} fill={`url(#${hatchPatternId})`} />
      <line x1={wallEndX} y1={y - 8} x2={wallEndX} y2={y + height + 8} stroke="#d52228" strokeWidth="2" strokeDasharray="5 4" />
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={mirrored ? "start" : "end"}
        fontFamily="var(--studio-mono)"
        fontSize="10"
        fontWeight="bold"
        fill="#b21f25"
      >
        {`OVER WALL BY +${formatSixteenths(overflowSixteenths)}`}
      </text>
    </g>
  );
}

function HeightChain({
  model,
  layout,
  tallUnitCount
}: {
  model: Round2Model | null;
  layout: VerticalLayout;
  tallUnitCount: number;
}) {
  const { profile } = layout;
  const roomChainX = roomHeightChainX(tallUnitCount);
  return (
    <g data-elevation-layer="height-chain">
      <path
        d={`M ${roomChainX - 6} ${CEILING_Y} H ${roomChainX + 6} M ${roomChainX - 6} ${FLOOR_Y} H ${roomChainX + 6} M ${roomChainX} ${CEILING_Y} V ${FLOOR_Y}`}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <DimensionValue
        value={model?.ceilingHeightSixteenths}
        x={roomChainX}
        y={(CEILING_Y + FLOOR_Y) / 2}
        vertical
        attribute="data-height-label"
        id="ceiling"
      />
      <path
        d={`M ${PROFILE_HEIGHT_CHAIN_X - 4} ${layout.baseBodyTop} H ${PROFILE_HEIGHT_CHAIN_X + 4} M ${PROFILE_HEIGHT_CHAIN_X - 4} ${FLOOR_Y} H ${PROFILE_HEIGHT_CHAIN_X + 4} M ${PROFILE_HEIGHT_CHAIN_X} ${layout.baseBodyTop} V ${FLOOR_Y}`}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <DimensionValue
        value={baseBodyHeightSixteenths(profile)}
        x={PROFILE_HEIGHT_CHAIN_X}
        y={(layout.baseBodyTop + FLOOR_Y) / 2}
        vertical
        attribute="data-height-label"
        id="counter"
      />
      <path
        d={`M ${PROFILE_HEIGHT_CHAIN_X - 4} ${layout.upperTop} H ${PROFILE_HEIGHT_CHAIN_X + 4} M ${PROFILE_HEIGHT_CHAIN_X - 4} ${layout.upperBottom} H ${PROFILE_HEIGHT_CHAIN_X + 4} M ${PROFILE_HEIGHT_CHAIN_X} ${layout.upperTop} V ${layout.upperBottom}`}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <DimensionValue
        value={profile.upperHeightSixteenths}
        x={PROFILE_HEIGHT_CHAIN_X}
        y={(layout.upperTop + layout.upperBottom) / 2}
        vertical
        attribute="data-height-label"
        id="upper"
      />
    </g>
  );
}

/**
 * Counter surface over the straight base run: one line per contiguous run of
 * counter-topped base segments (tall units and freestanding ranges break it).
 */
function CounterBand({
  fixedPoints,
  base,
  total,
  layout,
  mirrored
}: {
  fixedPoints: Round2FixedPoint[];
  base: WallSegment[];
  total: number;
  layout: VerticalLayout;
  mirrored: boolean;
}) {
  type Placed = { segment: WallSegment; start: number; end: number };
  const placed: Placed[] = [];
  let cursor = 0;
  for (const segment of base) {
    const width = (Math.max(0, segment.widthSixteenths) / total) * RUN_WIDTH;
    const x = mirrored
      ? RUN_LEFT + RUN_WIDTH - cursor - width
      : RUN_LEFT + cursor;
    placed.push({ segment, start: x, end: x + width });
    cursor += width;
  }
  placed.sort((a, b) => a.start - b.start);

  const bands: { start: number; end: number }[] = [];
  const slabs: { start: number; end: number }[] = [];
  for (const item of placed) {
    if (!hasCountertop(item.segment, fixedPoints)) continue;
    const previous = bands[bands.length - 1];
    if (previous && Math.abs(previous.end - item.start) < 0.5) {
      previous.end = item.end;
    } else {
      bands.push({ start: item.start, end: item.end });
    }

    if (!hasCountertopSlabShadow(item.segment, fixedPoints)) continue;
    const previousSlab = slabs[slabs.length - 1];
    if (previousSlab && Math.abs(previousSlab.end - item.start) < 0.5) {
      previousSlab.end = item.end;
    } else {
      slabs.push({ start: item.start, end: item.end });
    }
  }
  if (bands.length === 0) return null;

  const thickness = layout.baseBodyTop - layout.baseTop;
  return (
    <g data-elevation-layer="countertop" className="pointer-events-none">
      {thickness > 0 &&
        slabs.map((slab, index) => (
          <rect
            key={`slab-${index}`}
            data-countertop-slab={index}
            x={slab.start}
            y={layout.baseTop}
            width={Math.max(1, slab.end - slab.start)}
            height={thickness}
            fill={COUNTER_SLAB_FILL}
            stroke={COUNTER_SLAB_STROKE}
            strokeWidth="1"
          />
        ))}
      {bands.map((band, index) => {
        const left = Math.max(RUN_LEFT, band.start - COUNTER_END_OVERHANG_PX);
        const right = Math.min(
          RUN_LEFT + RUN_WIDTH,
          band.end + COUNTER_END_OVERHANG_PX
        );
        return (
          <g key={index} data-countertop-band={index}>
            <line
              data-countertop-band={index}
              x1={left}
              y1={layout.baseTop}
              x2={right}
              y2={layout.baseTop}
              stroke={COUNTER_SLAB_STROKE}
              strokeWidth="2"
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Tall units (refrigerator, oven/pantry towers) run floor-to-cabinet-top with
 * no counter/upper split, so each gets its own external overall-height
 * dimension lane.
 */
function TallUnitHeights({
  base,
  total,
  layout,
  fridgeAboveHeights = EMPTY_ABOVE_HEIGHTS
}: {
  base: WallSegment[];
  total: number;
  layout: VerticalLayout;
  fridgeAboveHeights?: ReadonlyMap<string, number>;
}) {
  const fullHeight =
    layout.profile.counterSixteenths +
    layout.profile.backsplashSixteenths +
    layout.profile.upperHeightSixteenths;
  let cursor = 0;
  let tallLane = 0;
  return (
    <g data-elevation-layer="tall-height">
      {base.map((segment) => {
        const widthPx = (Math.max(0, segment.widthSixteenths) / total) * RUN_WIDTH;
        cursor += widthPx;
        if (segment.cabinetKind !== "tall") return null;
        // When a wall cabinet / panel sits above the fridge, the tall column
        // stacks two dimensions: the above unit's height near the ceiling and
        // the shortened fridge height beneath it.
        const aboveHeight = fridgeAboveHeightForSegment(
          segment,
          fridgeAboveHeights
        );
        const x = TALL_HEIGHT_CHAIN_X - tallLane * TALL_HEIGHT_LANE_STEP;
        tallLane += 1;
        const fridgeTop =
          aboveHeight == null
            ? layout.upperTop
            : layout.upperTop + aboveHeight * layout.scale;
        const fridgeHeight =
          aboveHeight == null ? fullHeight : fullHeight - aboveHeight;

        const chain = (
          top: number,
          bottom: number,
          heightSixteenths: number,
          key: string,
          labelAttr?: string
        ) => {
          const mid = (top + bottom) / 2;
          return (
            <g key={key}>
              <path
                d={`M ${x - 4} ${top} H ${x + 4} M ${x - 4} ${bottom} H ${x + 4} M ${x} ${top} V ${bottom}`}
                strokeWidth={DIMENSION_STROKE_WIDTH}
              />
              <DimensionValue
                value={heightSixteenths}
                x={x}
                y={mid}
                vertical
                attribute={labelAttr ? "data-tall-height-label" : undefined}
                id={labelAttr}
              />
            </g>
          );
        };

        return (
          <g key={`tall-${segment.id}`}>
            {aboveHeight != null &&
              chain(
                layout.upperTop,
                fridgeTop,
                aboveHeight,
                `above-${segment.id}`,
                `above-${segment.id}`
              )}
            {chain(fridgeTop, FLOOR_Y, fridgeHeight, `fridge-${segment.id}`, segment.id)}
          </g>
        );
      })}
    </g>
  );
}

/**
 * The sink upper module hangs shorter than the rest of the run, so it carries
 * its own height dimension inside its column, hung from the upper top.
 */
function SinkUpperHeights({
  upper,
  total,
  layout,
  mirrored,
  sinkUpperHeights
}: {
  upper: WallSegment[];
  total: number;
  layout: VerticalLayout;
  mirrored: boolean;
  sinkUpperHeights: ReadonlyMap<string, number>;
}) {
  let cursor = 0;
  return (
    <g data-elevation-layer="sink-upper-height">
      {upper.map((segment) => {
        const widthPx =
          (Math.max(0, segment.widthSixteenths) / total) * RUN_WIDTH;
        const x = mirrored
          ? RUN_LEFT + RUN_WIDTH - cursor - widthPx
          : RUN_LEFT + cursor;
        cursor += widthPx;
        const heightSixteenths = sinkUpperHeights.get(segment.id);
        if (heightSixteenths == null) return null;
        const chainX = x + Math.min(14, widthPx / 2);
        const top = layout.upperTop;
        const bottom = top + heightSixteenths * layout.scale;
        const mid = (top + bottom) / 2;
        return (
          <g key={`sink-upper-${segment.id}`}>
            <path
              d={`M ${chainX - 4} ${top} H ${chainX + 4} M ${chainX - 4} ${bottom} H ${chainX + 4} M ${chainX} ${top} V ${bottom}`}
              strokeWidth={DIMENSION_STROKE_WIDTH}
            />
            <DimensionValue
              value={heightSixteenths}
              x={chainX}
              y={mid}
              vertical
              attribute="data-sink-upper-height"
              id={segment.id}
            />
          </g>
        );
      })}
    </g>
  );
}

function ElevationRun({
  fixedPoints,
  segments,
  total,
  layout,
  designIntent,
  labelSide,
  selectedObjectId,
  lastAbsorbed,
  mirrored,
  cornerReturns,
  cornerHostSides,
  hatchPatternId,
  fridgeAboveHeights = EMPTY_ABOVE_HEIGHTS,
  sinkUpperHeights = EMPTY_ABOVE_HEIGHTS,
  onActivate
}: {
  fixedPoints: Round2FixedPoint[];
  segments: WallSegment[];
  total: number;
  layout: VerticalLayout;
  designIntent?: Round2DesignIntent;
  labelSide: "above" | "below";
  selectedObjectId: string | null;
  lastAbsorbed?: Round2AbsorbedChange | null;
  mirrored: boolean;
  cornerReturns?: Map<string, CornerReturnTarget>;
  cornerHostSides?: Map<string, CornerEnd>;
  hatchPatternId?: string;
  fridgeAboveHeights?: ReadonlyMap<string, number>;
  sinkUpperHeights?: ReadonlyMap<string, number>;
  onActivate: (segment: WallSegment) => void;
}) {
  const widthsPx = segments.map(
    (segment) => (Math.max(0, segment.widthSixteenths) / total) * RUN_WIDTH
  );
  const centers = runSegmentCenters(widthsPx, mirrored);
  const breakdownParts = segments.map((segment, index) => {
    const atLeft = cornerBreakdownSide(
      segment,
      index,
      segments.length,
      mirrored,
      cornerReturns,
      cornerHostSides
    );
    if (atLeft == null) return null;
    return cornerBreakdownParts(
      centers[index] - widthsPx[index] / 2,
      widthsPx[index],
      segment.tier,
      total,
      atLeft
    );
  });
  const breakdownPlacements = placeCornerBreakdownLabels(breakdownParts);
  const chainPlacements = placeRunChainLabels(
    segments,
    centers,
    widthsPx,
    segments.map(carriesChainLabel),
    labelSide
  );
  const breakdownGuideY = cornerBreakdownGuideY(
    labelSide,
    stackedChainReach(segments, chainPlacements)
  );
  const labelClipIdPrefix = useId().replaceAll(":", "");
  let cursor = 0;

  return (
    <g>
      {segments.map((segment, index) => {
        const width = widthsPx[index];
        const x = mirrored
          ? RUN_LEFT + RUN_WIDTH - cursor - width
          : RUN_LEFT + cursor;
        cursor += width;
        const { y, height } = segmentBox(
          segment,
          layout,
          fridgeAboveHeights,
          sinkUpperHeights
        );
        const selected = selectedObjectId === segment.id;
        const cornerReturn = resolveCornerReturn(
          segment,
          index,
          segments.length,
          cornerReturns
        );
        if (cornerReturn) {
          const chainPlacement = chainPlacements.get(segment.id);
          const chainLabelCenter = chainPlacement?.center ?? centers[index];
          return (
            <g
              key={segment.id}
              data-segment-id={segment.id}
              data-cabinet-id={segment.id}
              data-selected={selected}
              onClick={() => onActivate(segment)}
              className="group cursor-pointer"
            >
              <CornerReturnSection
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                tier={segment.tier}
                layout={layout}
                pxPerSixteenth={RUN_WIDTH / total}
                cornerAtLeft={
                  mirrored
                    ? cornerReturn.side === "end"
                    : cornerReturn.side === "start"
                }
                selected={selected}
                hatchPatternId={hatchPatternId}
              />
              <g data-elevation-layer="width-chain">
                <path
                  data-chain-guide={segment.id}
                  data-chain-stacked={chainPlacement?.stacked ?? false}
                  data-chain-segment-start={x}
                  data-chain-segment-end={x + width}
                  data-chain-label-x={chainLabelCenter}
                  d={widthChainGuidePath(x, width, labelSide, segment.tier)}
                  stroke={DIMENSION_COLOR}
                  strokeWidth={DIMENSION_STROKE_WIDTH}
                  fill="none"
                  className={PAIR_HIGHLIGHT_LINE}
                />
                <ChainWidthLabel
                  segment={segment}
                  segmentCenter={centers[index]}
                  placement={chainPlacement}
                  labelSide={labelSide}
                />
              </g>
              {breakdownParts[index] && (
                <CornerHostBreakdownDimensions
                  segmentId={segment.id}
                  x={x}
                  width={width}
                  parts={breakdownParts[index]!}
                  placements={breakdownPlacements[index]}
                  labelSide={labelSide}
                  guideY={breakdownGuideY}
                />
              )}
            </g>
          );
        }
        // A hosted corner cabinet is partly covered by the adjacent run's
        // side profile; its face lives in the remaining visible zone.
        const hostedCornerEnd = resolveHostedCornerEnd(segment, cornerHostSides);
        const breakdownCornerEnd =
          hostedCornerEnd ??
          resolveUpperCornerEnd(segment, index, segments.length, cornerHostSides);
        const fillerLike = isFillerLikeSegment(segment);
        const intentionalGap = segment.kind === "gap" && segment.intentionalGap;
        const front =
          fillerLike ||
          segment.kind === "panel" ||
          segment.cabinetKind === "corner" ||
          breakdownCornerEnd != null
            ? null
            : resolveSegmentFront(segment, designIntent);
        const role = resolveSegmentRole(segment, { fixedPoints });
        const roleTag = role ? SEGMENT_ROLE_TAGS[role] : null;
        const trashPulloutTag = front?.accessories.includes("trashPullout")
          ? "TP"
          : null;
        const isWindow =
          segment.kind === "opening" &&
          fixedPoints.find((point) => point.id === segment.sourceFixedPointId)
            ?.type === "window";
        const clipId = `${labelClipIdPrefix}-${sanitizeSvgId(segment.id)}-label`;
        const hostedAtLeft =
          hostedCornerEnd != null &&
          (mirrored ? hostedCornerEnd === "end" : hostedCornerEnd === "start");
        const hostedOverlap =
          hostedCornerEnd != null
            ? Math.min(
                width,
                CABINET_STANDARDS.depths.baseSixteenths * (RUN_WIDTH / total)
              )
            : 0;
        const chainPlacement = chainPlacements.get(segment.id);
        const chainLabelCenter = chainPlacement?.center ?? centers[index];
        return (
          <g
            key={segment.id}
            data-segment-id={segment.id}
            data-cabinet-id={segment.id}
            data-selected={selected}
            onClick={() => onActivate(segment)}
            className="group cursor-pointer"
          >
            <clipPath id={clipId}>
              <rect x={x} y={y} width={Math.max(8, width)} height={height} />
            </clipPath>
            <rect
              data-open-gap={intentionalGap ? segment.id : undefined}
              x={x}
              y={y}
              width={Math.max(8, width)}
              height={height}
              fill={segmentFill(segment)}
              fillOpacity={1}
              stroke={
                selected
                  ? "#079ca5"
                  : intentionalGap
                    ? "#8b9490"
                    : "#1d1d1b"
              }
              strokeWidth={selected ? 3 : 1.5}
              strokeDasharray={intentionalGap ? "6 4" : undefined}
              className={selected ? undefined : PAIR_HIGHLIGHT_BODY}
            />
            {front && hostedCornerEnd == null && (
              <SegmentFace
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                front={front}
                accent={CABINET_FACE_STROKE}
                role={role}
              />
            )}
            {front && hostedCornerEnd != null && (
              <CornerFrontFace
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                overlap={hostedOverlap}
                atLeft={hostedAtLeft}
                front={front}
                accent={CABINET_FACE_STROKE}
              />
            )}
            {role ? (
              <ApplianceGlyph
                role={role}
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                stroke={CABINET_FACE_STROKE}
              />
            ) : (
              !front &&
              segment.kind === "appliance" && (
                <path
                  d={`M ${x + 4} ${y + 4} L ${x + width / 2} ${y + height / 2} L ${x + width - 4} ${y + 4}`}
                  stroke={CABINET_FACE_STROKE}
                  strokeWidth="1"
                  fill="none"
                />
              )
            )}
            {isWindow && (
              <WindowGlyph
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                stroke={CABINET_FACE_STROKE}
              />
            )}
            {(roleTag || trashPulloutTag) && width >= 26 && (
              <text
                data-role-tag={role ?? "trashPullout"}
                x={x + width / 2}
                y={y + height / 2 + 18}
                textAnchor="middle"
                fontFamily="var(--studio-mono)"
                fontSize="8"
                letterSpacing="0.08em"
                fill="#5d6b64"
                clipPath={`url(#${clipId})`}
              >
                {roleTag ?? trashPulloutTag}
              </text>
            )}
            {(segment.kind !== "gap" || intentionalGap) && (
              <g data-elevation-layer="width-chain">
                <path
                  data-chain-guide={segment.id}
                  data-chain-stacked={chainPlacement?.stacked ?? false}
                  data-chain-segment-start={x}
                  data-chain-segment-end={x + width}
                  data-chain-label-x={chainLabelCenter}
                  d={widthChainGuidePath(x, width, labelSide, segment.tier)}
                  stroke={DIMENSION_COLOR}
                  strokeWidth={DIMENSION_STROKE_WIDTH}
                  fill="none"
                  className={PAIR_HIGHLIGHT_LINE}
                />
                <ChainWidthLabel
                  segment={segment}
                  segmentCenter={centers[index]}
                  placement={chainPlacement}
                  labelSide={labelSide}
                />
              </g>
            )}
            {breakdownParts[index] && (
              <CornerHostBreakdownDimensions
                segmentId={segment.id}
                x={x}
                width={width}
                parts={breakdownParts[index]!}
                placements={breakdownPlacements[index]}
                labelSide={labelSide}
                guideY={breakdownGuideY}
              />
            )}
            {lastAbsorbed?.segmentId === segment.id && (
              <g
                key={`absorb-${lastAbsorbed.token}`}
                data-elevation-layer="absorb-pulse"
                className="pointer-events-none"
              >
                <rect
                  x={x}
                  y={y}
                  width={Math.max(8, width)}
                  height={height}
                  fill="#e8b93b"
                  opacity="0"
                >
                  <animate
                    attributeName="opacity"
                    values="0;0.4;0;0.35;0"
                    dur="1.5s"
                    repeatCount="1"
                    fill="freeze"
                  />
                </rect>
                <text
                  data-absorb-delta={lastAbsorbed.deltaSixteenths}
                  x={x + width / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontFamily="var(--studio-mono)"
                  fontSize="11"
                  fontWeight="bold"
                  fill="#9a6b00"
                >
                  {`${lastAbsorbed.deltaSixteenths > 0 ? "+" : "−"}${formatSixteenths(
                    Math.abs(lastAbsorbed.deltaSixteenths)
                  )}`}
                  <animate
                    attributeName="opacity"
                    values="1;1;0"
                    dur="2.2s"
                    repeatCount="1"
                    fill="freeze"
                  />
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

function isMirroredElevationWall(
  wall: ReturnType<typeof findWall>
): boolean {
  // LEFT walls are measured top-to-bottom in plan. From inside the room, that
  // top/back corner appears on the right side of the wall elevation.
  return wall?.sourceWall === "LEFT";
}

function buildCornerReturnTargets(
  model: Round2Model | null,
  wall: ReturnType<typeof findWall>
): Map<string, CornerReturnTarget> {
  const targets = new Map<string, CornerReturnTarget>();
  if (!model || !wall) return targets;
  for (const corner of deriveCorners(model)) {
    if (corner.secondary.id !== wall.id) continue;
    targets.set(corner.id, {
      side: corner.secondaryEnd
    });
  }
  return targets;
}

function insideCornerEnds(
  model: Round2Model | null,
  wall: ReturnType<typeof findWall>
): CornerEnd[] {
  if (!model || !wall) return [];
  const ends = new Set<CornerEnd>();
  for (const corner of deriveCorners(model)) {
    if (corner.primary.id === wall.id) ends.add(corner.primaryEnd);
    if (corner.secondary.id === wall.id) ends.add(corner.secondaryEnd);
  }
  return [...ends];
}

// Corner reservations whose corner is not derivable (e.g. the paired wall is
// missing from the model) still draw the section treatment; they just lose
// the cross-wall jump tag. The corner side falls back to the run end the gap
// actually sits on.
function fallbackCornerReturn(
  index: number,
  segmentCount: number
): CornerReturnTarget {
  return {
    side: index > 0 && index === segmentCount - 1 ? "end" : "start"
  };
}

function cornerReferenceDepthSixteenths(tier: WallSegment["tier"]): number {
  return tier === "upper"
    ? CABINET_STANDARDS.depths.upperSixteenths
    : CABINET_STANDARDS.depths.baseSixteenths;
}

/**
 * A hosted corner cabinet keeps its overall width chain and adds a second,
 * sectional chain for the part crossed by the adjacent wall: upper depth 12″
 * plus its remainder, or base depth 24″ plus its remainder.
 */
function CornerHostBreakdownDimensions({
  segmentId,
  x,
  width,
  parts,
  placements,
  labelSide,
  guideY
}: {
  segmentId: string;
  x: number;
  width: number;
  parts: CornerBreakdownParts;
  placements: CornerBreakdownPlacements;
  labelSide: "above" | "below";
  guideY: number;
}) {
  const labelY = guideY;
  const tickEndY = guideY + (labelSide === "above" ? WIDTH_CHAIN_EXTENSION_LENGTH : -WIDTH_CHAIN_EXTENSION_LENGTH);
  const slots = [
    { slot: "first" as const, part: parts.first, placement: placements.first },
    { slot: "second" as const, part: parts.second, placement: placements.second }
  ];

  return (
    <g
      data-elevation-layer="corner-breakdown"
      data-corner-breakdown={segmentId}
      stroke={DIMENSION_COLOR}
      fill={DIMENSION_COLOR}
      fontFamily="var(--studio-mono)"
    >
      <path
        data-corner-breakdown-guide={segmentId}
        d={`M ${x} ${guideY} V ${tickEndY} M ${x} ${guideY} H ${parts.splitX} M ${parts.splitX} ${guideY} V ${tickEndY} M ${parts.splitX} ${guideY} H ${x + width} M ${x + width} ${guideY} V ${tickEndY}`}
        strokeWidth={DIMENSION_STROKE_WIDTH}
        fill="none"
        className={PAIR_HIGHLIGHT_LINE}
      />
      {slots.map(({ slot, part, placement }) => {
        if (part.width <= 0 || !placement) return null;
        return (
          <g key={slot}>
            <DimensionValue
              value={part.sixteenths}
              x={placement.center}
              y={labelY}
              attribute="data-corner-breakdown-label"
              id={slot}
              className={PAIR_HIGHLIGHT_TEXT}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * The sectional chain sits one row outside the width chain it belongs to, and
 * beyond whatever numbers that chain has stacked into the same gutter.
 */
function cornerBreakdownGuideY(
  labelSide: "above" | "below",
  stackedReach = 0
): number {
  if (labelSide === "above") return UPPER_CHAIN_LABEL_Y + 27;
  return Math.min(
    ELEVATION_VIEWBOX_TOP + ELEVATION_VIEWBOX_HEIGHT - 12,
    Math.max(
      widthChainGuideY("below", "base") + 32,
      widthChainGuideY("below", "base") + stackedReach + STACKED_LABEL_LEAD
    )
  );
}

type CornerBreakdownPart = {
  /** Midpoint of this part of the split, before any placement. */
  center: number;
  width: number;
  sixteenths: number;
};

type CornerBreakdownParts = {
  splitX: number;
  first: CornerBreakdownPart;
  second: CornerBreakdownPart;
};

type CornerBreakdownPlacements = {
  first?: DimensionLabelPlacement;
  second?: DimensionLabelPlacement;
};

/** Where the adjacent wall cuts a hosted corner cabinet, and what each side reads. */
function cornerBreakdownParts(
  x: number,
  width: number,
  tier: WallSegment["tier"],
  total: number,
  atLeft: boolean
): CornerBreakdownParts {
  const depthSixteenths = cornerReferenceDepthSixteenths(tier);
  const depthWidth = Math.min(width, (depthSixteenths / total) * RUN_WIDTH);
  const remainderWidth = Math.max(0, width - depthWidth);
  const remainderSixteenths = Math.max(
    0,
    Math.round((remainderWidth / RUN_WIDTH) * total)
  );
  const splitX = atLeft ? x + depthWidth : x + remainderWidth;
  const firstWidth = splitX - x;
  const secondWidth = x + width - splitX;
  return {
    splitX,
    first: {
      center: x + firstWidth / 2,
      width: firstWidth,
      sixteenths: atLeft ? depthSixteenths : remainderSixteenths
    },
    second: {
      center: splitX + secondWidth / 2,
      width: secondWidth,
      sixteenths: atLeft ? remainderSixteenths : depthSixteenths
    }
  };
}

/**
 * The breakdown row is packed as one row across the whole run: a wall can host
 * a corner at each end, and a shallow remainder puts its number right on top of
 * the depth number beside it. The row has no headroom for a second lane — the
 * width chain sits directly against it — so labels only ever slide.
 */
function placeCornerBreakdownLabels(
  parts: readonly (CornerBreakdownParts | null)[]
): CornerBreakdownPlacements[] {
  const slots: {
    index: number;
    slot: "first" | "second";
    center: number;
    text: string;
  }[] = [];
  parts.forEach((part, index) => {
    if (!part) return;
    for (const slot of ["first", "second"] as const) {
      if (part[slot].width <= 0) continue;
      slots.push({
        index,
        slot,
        center: part[slot].center,
        text: formatSixteenths(part[slot].sixteenths)
      });
    }
  });

  const placed = layoutDimensionLabels(slots, {
    fontSize: DIMENSION_FONT_SIZE,
    bounds: [RUN_LEFT, RUN_LEFT + RUN_WIDTH],
    maxLanes: 1
  });
  const placements: CornerBreakdownPlacements[] = parts.map(() => ({}));
  slots.forEach(({ index, slot }, position) => {
    placements[index][slot] = placed[position];
  });
  return placements;
}

/** Corners hosted by this wall (it carries the corner cabinet itself). */
function buildCornerHostSides(
  model: Round2Model | null,
  wall: ReturnType<typeof findWall>
): Map<string, CornerEnd> {
  const sides = new Map<string, CornerEnd>();
  if (!model || !wall) return sides;
  for (const corner of deriveCorners(model)) {
    if (corner.primary.id === wall.id) sides.set(corner.id, corner.primaryEnd);
  }
  return sides;
}

/**
 * On the hosting wall the adjacent run also crosses the picture plane at the
 * corner: its side elevation overlaps the first base-depth (24″) / upper-depth
 * (12″) of the corner cabinet. Drawn wall-level, translucent and inert, so the
 * cabinet underneath stays selectable.
 */
function CornerSideProfile({
  atLeft,
  layout,
  pxPerSixteenth,
  hatchPatternId
}: {
  atLeft: boolean;
  layout: VerticalLayout;
  pxPerSixteenth: number;
  hatchPatternId?: string;
}) {
  const depths = CABINET_STANDARDS.depths;
  const baseWidth = depths.baseSixteenths * pxPerSixteenth;
  const upperWidth = depths.upperSixteenths * pxPerSixteenth;
  const baseX = atLeft ? RUN_LEFT : RUN_LEFT + RUN_WIDTH - baseWidth;
  const upperX = atLeft ? RUN_LEFT : RUN_LEFT + RUN_WIDTH - upperWidth;
  const toeHeight = Math.max(6, TOE_KICK_HEIGHT_SIXTEENTHS * layout.scale);
  const toeDepth = Math.min(
    baseWidth / 3,
    TOE_KICK_DEPTH_SIXTEENTHS * pxPerSixteenth
  );
  const faceTop = layout.baseTop;
  const profileFill = hatchPatternId ? `url(#${hatchPatternId})` : "none";
  const basePath = atLeft
    ? `M ${baseX} ${faceTop} H ${baseX + baseWidth} V ${FLOOR_Y - toeHeight} H ${baseX + baseWidth - toeDepth} V ${FLOOR_Y} H ${baseX} Z`
    : `M ${baseX + baseWidth} ${faceTop} H ${baseX} V ${FLOOR_Y - toeHeight} H ${baseX + toeDepth} V ${FLOOR_Y} H ${baseX + baseWidth} Z`;
  return (
    <g
      data-elevation-layer="corner-side-profile"
      className="pointer-events-none"
    >
      <line
        data-corner-side-profile="counter"
        x1={baseX}
        y1={layout.baseTop}
        x2={baseX + baseWidth}
        y2={layout.baseTop}
        stroke="#1d1d1b"
        strokeWidth="2"
      />
      <path
        data-corner-side-profile="base"
        d={basePath}
        fill={profileFill}
        stroke={CORNER_SECTION_COLOR}
        strokeWidth="1.5"
      />
      <rect
        data-corner-side-profile="upper"
        x={upperX}
        y={layout.upperTop}
        width={upperWidth}
        height={layout.upperBottom - layout.upperTop}
        fill={profileFill}
        stroke={CORNER_SECTION_COLOR}
        strokeWidth="1.5"
      />
    </g>
  );
}

/**
 * Corner cabinet front on its hosting wall: a bi-fold door glyph hinged at
 * the adjacent run's side profile, folding into the visible remainder.
 */
function CornerFrontFace({
  x,
  y,
  width,
  height,
  overlap,
  atLeft,
  front,
  accent
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  overlap: number;
  atLeft: boolean;
  front: ResolvedFront;
  accent: string;
}) {
  const hingeX = atLeft ? x + overlap : x + width - overlap;
  const farX = atLeft ? x + width - 4 : x + 4;
  const foldX = (hingeX + farX) / 2;
  const visible = Math.max(0, width - overlap);
  return (
    <g data-face="corner-front" stroke={accent} strokeWidth="1" fill="none">
      {visible > 12 && (
        <>
          <path
            d={`M ${hingeX + (atLeft ? 2 : -2)} ${y + 4} L ${farX} ${y + height / 2} L ${hingeX + (atLeft ? 2 : -2)} ${y + height - 4}`}
          />
          <line x1={foldX} y1={y + 6} x2={foldX} y2={y + height - 6} />
        </>
      )}
      <AccessoryTag x={atLeft ? hingeX : x} y={y} front={front} />
    </g>
  );
}

/**
 * A corner cabinet's footprint on the adjacent wall, drawn to section
 * conventions instead of an empty reservation box: the run's side profile is
 * cut by the picture plane (hatch + toe-kick notch), the counter reads as a
 * poché slab, and the carcass hidden behind the section is dashed.
 */
function CornerReturnSection({
  x,
  y,
  width,
  height,
  tier,
  layout,
  pxPerSixteenth,
  cornerAtLeft,
  selected,
  hatchPatternId
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  tier: WallSegment["tier"];
  layout: VerticalLayout;
  pxPerSixteenth: number;
  cornerAtLeft: boolean;
  selected: boolean;
  hatchPatternId?: string;
}) {
  const depths = CABINET_STANDARDS.depths;
  const isBase = tier !== "upper";
  const depthSixteenths = isBase ? depths.baseSixteenths : depths.upperSixteenths;
  const profileWidth = Math.min(width, depthSixteenths * pxPerSixteenth);
  const profileX = cornerAtLeft ? x : x + width - profileWidth;
  const toeHeight = Math.max(6, TOE_KICK_HEIGHT_SIXTEENTHS * layout.scale);
  const toeDepth = Math.min(
    profileWidth / 3,
    TOE_KICK_DEPTH_SIXTEENTHS * pxPerSixteenth
  );
  const faceTop = y;
  const floor = y + height;
  const profileFill = hatchPatternId
    ? `url(#${hatchPatternId})`
    : CORNER_RETURN_FILL;
  const visibleFaceX = cornerAtLeft ? x + profileWidth : x;
  const visibleFaceWidth = Math.max(0, width - profileWidth);
  // The toe-kick notch sits at the run's front edge — the side away from the
  // corner — so the section profile reads with the cabinet facing the room.
  const profilePath = cornerAtLeft
    ? `M ${profileX} ${faceTop} H ${profileX + profileWidth} V ${floor - toeHeight} H ${profileX + profileWidth - toeDepth} V ${floor} H ${profileX} Z`
    : `M ${profileX + profileWidth} ${faceTop} H ${profileX} V ${floor - toeHeight} H ${profileX + toeDepth} V ${floor} H ${profileX + profileWidth} Z`;
  return (
    <g data-face="corner-return">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={CORNER_RETURN_FILL}
        fillOpacity={1}
        stroke={selected ? "#079ca5" : HIDDEN_LINE_COLOR}
        strokeWidth={selected ? 3 : 1.2}
        strokeDasharray={selected ? undefined : "5 4"}
      />
      {visibleFaceWidth > 0 && (
        <rect
          data-corner-return-visible-face="true"
          x={visibleFaceX}
          y={faceTop}
          width={visibleFaceWidth}
          height={floor - faceTop}
          fill={CABINET_FILL}
          stroke="#1d1d1b"
          strokeWidth="1.5"
        />
      )}
      {isBase ? (
        <>
          <path
            data-corner-return-profile="true"
            d={profilePath}
            fill={profileFill}
            stroke={CORNER_SECTION_COLOR}
            strokeWidth="1.5"
          />
        </>
      ) : (
        <rect
          data-corner-return-profile="true"
          x={profileX}
          y={y}
          width={profileWidth}
          height={height}
          fill={profileFill}
          stroke={CORNER_SECTION_COLOR}
          strokeWidth="1.5"
        />
      )}
    </g>
  );
}

/**
 * Whether to draw this segment as a strip rather than a cabinet front. The
 * width test is the widest filler the shop supplies — not the preferred one,
 * which is only the strip width they reach for first.
 */
function isFillerLikeSegment(segment: WallSegment): boolean {
  const label = (segment.code ?? segment.label).trim();
  return (
    segment.kind === "filler" ||
    /^F\d/i.test(label) ||
    segment.widthSixteenths <= CABINET_STANDARDS.filler.maxSixteenths
  );
}

function sanitizeSvgId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * Cabinet face from the resolved front: drawer stacks render proportional
 * splits, doors render their V swing lines, accessories tag the corner.
 */
function SegmentFace({
  x,
  y,
  width,
  height,
  front,
  accent,
  role
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  front: ResolvedFront;
  accent: string;
  role?: string | null;
}) {
  let faceY = y;
  let faceHeight = height;
  let extraLines = null;

  if (role === "hood") {
    faceHeight = height - Math.min(height * 0.3, 15);
  } else if (role === "sink") {
    const falseFrontHeight = Math.min(height * 0.2, 18);
    faceY = y + falseFrontHeight;
    faceHeight = height - falseFrontHeight;
    extraLines = (
      <line x1={x + 3} y1={faceY} x2={x + width - 3} y2={faceY} stroke={accent} strokeWidth="1" fill="none" />
      );
  }

  // A trash pull-out is a single continuous front with a centered top pull,
  // not a hinged door. Keep it visually distinct from the standard door
  // notation while leaving its accessory data intact for the editor/schedule.
  if (front.accessories.includes("trashPullout")) {
    const handleWidth = Math.min(56, Math.max(24, width * 0.34));
    const handleHeight = Math.min(7, Math.max(4, faceHeight * 0.055));
    const handleX = x + (width - handleWidth) / 2;
    const handleY = faceY + Math.min(12, Math.max(5, faceHeight * 0.06));

    return (
      <g data-face="trash-pullout" stroke={accent} strokeWidth="1" fill="none">
        {extraLines}
        {front.hardware === "handle" ? (
          <rect
            data-trash-pullout-handle="true"
            x={handleX}
            y={handleY}
            width={handleWidth}
            height={handleHeight}
            rx={handleHeight / 2}
            fill="#1d1d1b"
            stroke="none"
          />
        ) : (
          <line
            data-trash-pullout-handle="true"
            x1={handleX}
            y1={handleY + handleHeight / 2}
            x2={handleX + handleWidth}
            y2={handleY + handleHeight / 2}
            stroke="#1d1d1b"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        <AccessoryTag x={x} y={faceY} front={front} />
      </g>
    );
  }

  if (front.drawerStack.length > 0) {
    const totalUnits = front.drawerStack.reduce((sum, unit) => sum + unit, 0);
    let offset = 0;
    return (
      <g data-face="drawers" stroke={accent} strokeWidth="1" fill="none">
        {extraLines}
        {front.drawerStack.map((unit, index) => {
          offset += unit;
          const lineY = faceY + (offset / totalUnits) * faceHeight;
          return (
            <g key={index}>
              {index < front.drawerStack.length - 1 && (
                <line x1={x + 3} y1={lineY} x2={x + width - 3} y2={lineY} />
              )}
              <line
                x1={x + width / 2 - Math.min(9, width / 4)}
                y1={lineY - faceHeight * (unit / totalUnits) / 2}
                x2={x + width / 2 + Math.min(9, width / 4)}
                y2={lineY - faceHeight * (unit / totalUnits) / 2}
                strokeWidth="2"
              />
            </g>
          );
        })}
      </g>
    );
  }

  if (front.doorCount === 2) {
    return (
      <g data-face="double-door" stroke={accent} strokeWidth="1" fill="none">
        {extraLines}
        <line x1={x + width / 2} y1={faceY + 3} x2={x + width / 2} y2={faceY + faceHeight - 3} />
        <path strokeDasharray="6 4" d={`M ${x + width / 2 - 2} ${faceY + 3} L ${x + 3} ${faceY + faceHeight / 2} L ${x + width / 2 - 2} ${faceY + faceHeight - 3}`} />
        <path strokeDasharray="6 4" d={`M ${x + width / 2 + 2} ${faceY + 3} L ${x + width - 3} ${faceY + faceHeight / 2} L ${x + width / 2 + 2} ${faceY + faceHeight - 3}`} />
        <AccessoryTag x={x} y={faceY} front={front} />
      </g>
    );
  }

  if (front.doorCount === 1) {
    // Standard notation: hinge left (point to left)
    return (
      <g data-face="single-door" stroke={accent} strokeWidth="1" fill="none">
        {extraLines}
        <path strokeDasharray="6 4" d={`M ${x + width - 4} ${faceY + 4} L ${x + 4} ${faceY + faceHeight / 2} L ${x + width - 4} ${faceY + faceHeight - 4}`} />
        <AccessoryTag x={x} y={faceY} front={front} />
      </g>
    );
  }

  return (
    <g>
      {extraLines}
      <AccessoryTag x={x} y={faceY} front={front} />
    </g>
  );
}

const ACCESSORY_TAGS: Record<string, string> = {
  spicePullout: "SP",
  lazySusan: "LS",
  magicCorner: "MC",
  blindCornerPullOut: "BCP",
  cornerPullOutShelves: "CPS"
};

function AccessoryTag({
  x,
  y,
  front
}: {
  x: number;
  y: number;
  front: ResolvedFront;
}) {
  if (front.accessories.length === 0) return null;
  const displayedAccessories = front.accessories.filter(
    (item) => item !== "trashPullout"
  );
  if (displayedAccessories.length === 0) return null;
  return (
    <text
      data-accessory-tag={displayedAccessories.join("·")}
      x={x + 4}
      y={y + 11}
      fontFamily="var(--studio-mono)"
      fontSize="7"
      fill="#7a5b00"
      stroke="none"
    >
      {displayedAccessories
        .map((item) => ACCESSORY_TAGS[item] ?? item)
        .join("·")}
    </text>
  );
}

const CARD_CHIP_CLASS =
  "h-7 rounded-[7px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted outline-none transition-colors hover:border-studio-ink aria-pressed:border-studio-ink aria-pressed:bg-studio-ink aria-pressed:text-white";

const FACE_OPTIONS: {
  label: string;
  doorCount: 0 | 1 | 2;
  drawerStack: number[];
}[] = [
  { label: "1 door", doorCount: 1, drawerStack: [] },
  { label: "2 doors", doorCount: 2, drawerStack: [] },
  { label: "2 drawers", doorCount: 0, drawerStack: [1, 1] },
  { label: "3 drawers", doorCount: 0, drawerStack: [1, 1, 1] }
];

const STANDARD_ACCESSORY_OPTIONS: FrontAccessory[] = [
  "trashPullout",
  "spicePullout"
];

const CORNER_ACCESSORY_OPTIONS: FrontAccessory[] = [
  "lazySusan",
  "magicCorner",
  "blindCornerPullOut",
  "cornerPullOutShelves"
];

export const KIND_OPTIONS: { value: CabinetKind; label: string }[] = [
  { value: "base", label: "Base" },
  { value: "tall", label: "Tall" }
];

/** Human-readable name shown in the segment editor header. */
export function segmentEditorName(
  segment: WallSegment,
  front: ResolvedFront | null
): string {
  if (front?.accessories.includes("trashPullout")) return "trash pullout";
  if (front?.accessories.includes("spicePullout")) return "spice pullout";
  if (segment.cabinetKind === "corner") return "转角柜";
  if (segment.tier === "upper" || segment.cabinetKind === "upper") {
    return "吊柜";
  }
  if (segment.cabinetKind === "tall") return "高柜";
  if (segment.cabinetKind === "base" || segment.cabinetKind === "sink") {
    return "地柜";
  }
  if (segment.kind === "panel") return "见光板";
  if (segment.kind === "filler") return "填充板";
  if (segment.kind === "gap") return "开放空间";
  if (segment.kind === "opening") return "开口";
  if (segment.kind === "appliance") return "电器";
  return "柜子";
}

export function canEditSegmentKind(segment: WallSegment): boolean {
  return (
    segment.kind === "cabinet" &&
    segment.tier !== "upper" &&
    segment.cabinetKind !== "corner" &&
    segment.sourceCornerId == null
  );
}

export function canOpenSegmentEditor(segment: WallSegment): boolean {
  if (segment.kind === "opening") return false;
  if (segment.kind === "gap") {
    return Boolean(segment.sourceCornerId || segment.intentionalGap);
  }
  return true;
}

export function accessoryOptionsForSegment(
  segment: WallSegment
): FrontAccessory[] {
  return segment.cabinetKind === "corner"
    ? [...CORNER_ACCESSORY_OPTIONS]
    : [...STANDARD_ACCESSORY_OPTIONS];
}

/** Standard width chips for an editable appliance; empty for unknown symbols. */
function applianceWidthOptions(symbol: string | undefined): number[] {
  const appliances = CABINET_STANDARDS.appliances;
  const definition =
    symbol === "fridge"
      ? appliances.refrigerator
      : symbol === "range"
        ? appliances.range
        : symbol === "sink"
          ? appliances.sinkBase
          : symbol === "dishwasher"
            ? appliances.dishwasher
            : null;
  return definition ? [...definition.widthOptionsSixteenths] : [];
}

/**
 * Merge buttons for the unit on each side. Merging is how a unit is removed:
 * its width is handed to the neighbour, so the run keeps its start and end and
 * nothing else on the wall moves. Each button names what the merge produces
 * (`B24`) rather than the act, so the outcome is readable before the click.
 * A side with no same-tier neighbour is not offered; a side that would absorb
 * fixed geometry is offered disabled, with the reason underneath.
 */
function MergeControls({
  segment,
  wall,
  sectionLabel,
  dispatch
}: {
  segment: WallSegment;
  wall: Round2Wall;
  sectionLabel: string;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const sides = (["left", "right"] as const).map((side) => ({
    side,
    preview: previewMerge(wall, segment.id, side)
  }));
  const offered = sides.filter(({ preview }) => preview != null);
  if (offered.length === 0) return null;

  const note =
    offered.find(({ preview }) => preview?.blockedReason)?.preview
      ?.blockedReason ??
    (offered.some(({ preview }) => preview?.oversize)
      ? "Over the standard maximum — it goes on the schedule as made to order."
      : null);

  return (
    <>
      <CardSectionLabel>{sectionLabel}</CardSectionLabel>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {sides.map(({ side, preview }) => {
          // A refused merge has no outcome to name — showing the width it
          // would have had reads as an offer. Only an allowed merge is named.
          const allowed = preview != null && preview.blockedReason == null;
          return (
            <button
              key={side}
              type="button"
              disabled={!allowed}
              aria-label={
                allowed
                  ? `Merge ${side} into ${preview.label}`
                  : `No unit to merge ${side}`
              }
              onClick={() =>
                allowed &&
                dispatch({
                  type: "MERGE_UNITS",
                  objectIds: [segment.id, preview.neighborId]
                })
              }
              className={cn(
                CARD_CHIP_CLASS,
                "flex flex-col items-center justify-center leading-tight disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-studio-line"
              )}
            >
              <span className="text-[7px] tracking-[0.08em] text-studio-quiet">
                {side === "left" ? "◀ MERGE LEFT" : "MERGE RIGHT ▶"}
              </span>
              <span>{allowed ? preview.label : "—"}</span>
            </button>
          );
        })}
      </div>
      {note && (
        <p className="mt-1.5 text-[9.5px] leading-4 text-studio-muted">{note}</p>
      )}
    </>
  );
}

function CardSectionLabel({ children }: { children: string }) {
  return (
    <span className="mt-2.5 block font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
      {children}
    </span>
  );
}

/**
 * The single editing entry point: clicking a cabinet or its chain label opens
 * this card. Cabinets take width steps / custom widths (STEP_CABINET_WIDTH,
 * absorbed by a same-zone filler), fronts and kinds; fillers expose placement
 * plus the reversible intentional-gap action — never a direct width edit.
 */
function SegmentEditorCard({
  segment,
  wall,
  designIntent,
  heightProfile,
  dispatch,
  onClose
}: {
  segment: WallSegment;
  wall: Round2Wall;
  designIntent?: Round2DesignIntent;
  heightProfile: Round2HeightProfile;
  dispatch: Dispatch<Round2PrototypeAction>;
  onClose: () => void;
}) {
  const isOrdinaryCabinet =
    segment.kind === "cabinet" &&
    segment.cabinetKind !== "corner" &&
    segment.sourceCornerId == null;
  const canAdjustWidth = isOrdinaryCabinet;
  const canSlide = isOrdinaryCabinet;
  const applianceSymbol =
    segment.kind === "appliance" &&
    segment.tier === "base" &&
    segment.sourceFixedPointId != null
      ? wall.fixedPoints.find(
          (point) => point.id === segment.sourceFixedPointId
        )?.symbol
      : undefined;
  const canAdjustApplianceWidth =
    applianceSymbol != null && applianceSymbol !== "hood";
  const isFiller = segment.kind === "filler";
  const isIntentionalGap = segment.kind === "gap" && segment.intentionalGap;
  const isPanel = segment.kind === "panel";
  const isMerged = (segment.mergedFrom?.length ?? 0) > 0;
  const front = isPanel ? null : resolveSegmentFront(segment, designIntent);
  const cornerIntentKey = cornerIntentKeyForSegment(segment);
  const fridgeIntentKeys = fridgeIntentKeysForSegment(segment, wall);
  const sinkOffset = segment.anchored
    ? sinkCenteringOffsetSixteenths(wall, segment)
    : null;

  return (
    <div
      data-testid="segment-editor-card"
      className="absolute bottom-3 left-1/2 z-20 max-h-[calc(100%-84px)] w-[320px] -translate-x-1/2 overflow-y-auto rounded-[12px] border border-studio-line bg-white p-3 shadow-[0_18px_42px_-18px_rgba(20,20,26,0.4)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold">
          {segmentEditorName(segment, front)} - {formatSixteenths(segment.widthSixteenths)}
        </span>
        <div className="flex items-center gap-1.5">
          {isFiller && (
            <span className="rounded-full bg-[#f6ead4] px-2 py-0.5 font-mono text-[7px] tracking-[0.08em] text-[#815416]">
              REMAINDER · AUTO
            </span>
          )}
          {isIntentionalGap && (
            <span className="rounded-full bg-[#eef1ef] px-2 py-0.5 font-mono text-[7px] tracking-[0.08em] text-[#5d6b64]">
              OPEN GAP
            </span>
          )}
          <button
            type="button"
            aria-label="Close segment editor"
            onClick={onClose}
            className="rounded px-1.5 font-mono text-[11px] text-studio-muted hover:bg-black/5"
          >
            ✕
          </button>
        </div>
      </div>

      {cornerIntentKey && (
        <CornerSetupControls
          intentKey={cornerIntentKey}
          segment={segment}
          designIntent={designIntent}
          dispatch={dispatch}
        />
      )}

      {fridgeIntentKeys && (
        <FridgeSetupControls
          keys={fridgeIntentKeys}
          designIntent={designIntent}
          heightProfile={heightProfile}
          dispatch={dispatch}
        />
      )}

      {canAdjustWidth && (
        <>
          <CardSectionLabel>WIDTH</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-5 gap-1">
            {standardWidthOptionsSixteenths().map((width) => (
              <button
                key={width}
                type="button"
                aria-pressed={segment.widthSixteenths === width}
                onClick={() =>
                  dispatch({
                    type: "STEP_CABINET_WIDTH",
                    objectId: segment.id,
                    widthSixteenths: width
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {width / 16}″
              </button>
            ))}
          </div>
          <InchField
            value={segment.widthSixteenths}
            onChange={(value) => {
              if (
                value != null &&
                value >= CABINET_STANDARDS.base.widthsSixteenths[0]
              ) {
                dispatch({
                  type: "STEP_CABINET_WIDTH",
                  objectId: segment.id,
                  widthSixteenths: value
                });
              }
            }}
            ariaLabel="Custom width"
          />
          <MergeControls
            segment={segment}
            wall={wall}
            sectionLabel="MERGE"
            dispatch={dispatch}
          />
        </>
      )}

      {isMerged && (
        <button
          type="button"
          onClick={() => dispatch({ type: "SPLIT_UNIT", objectId: segment.id })}
          className="mt-1.5 w-full rounded-[8px] border border-studio-line bg-white px-2 py-1.5 font-mono text-[9px] text-studio-ink outline-none transition-colors hover:border-studio-ink"
        >
          Restore {segment.mergedFrom?.length} units
        </button>
      )}

      {canAdjustApplianceWidth && (
        <>
          <CardSectionLabel>APPLIANCE WIDTH</CardSectionLabel>
          {applianceWidthOptions(applianceSymbol).length > 0 && (
            <div className="mt-1.5 grid grid-cols-5 gap-1">
              {applianceWidthOptions(applianceSymbol).map((width) => (
                <button
                  key={width}
                  type="button"
                  aria-pressed={segment.widthSixteenths === width}
                  onClick={() =>
                    dispatch({
                      type: "SET_APPLIANCE_WIDTH",
                      objectId: segment.id,
                      widthSixteenths: width
                    })
                  }
                  className={CARD_CHIP_CLASS}
                >
                  {width / 16}″
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {front && (
        <>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
              FRONT
            </span>
            <span className="font-mono text-[8px] text-studio-muted">
              {describeFront(front)}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {FACE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={
                  front.doorCount === option.doorCount &&
                  front.drawerStack.length === option.drawerStack.length
                }
                onClick={() =>
                  dispatch({
                    type: "SET_SEGMENT_FRONT",
                    objectId: segment.id,
                    front: {
                      doorCount: option.doorCount,
                      drawerStack: option.drawerStack
                    }
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {(["handle", "fingerPull"] as const).map((hardware) => (
              <button
                key={hardware}
                type="button"
                aria-pressed={front.hardware === hardware}
                onClick={() =>
                  dispatch({
                    type: "SET_SEGMENT_FRONT",
                    objectId: segment.id,
                    front: { hardware }
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {hardware === "handle" ? "Handle" : "Finger pull"}
              </button>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {accessoryOptionsForSegment(segment).map((accessory) => {
              const active = front.accessories.includes(accessory);
              return (
                <button
                  key={accessory}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    dispatch({
                      type: "SET_SEGMENT_FRONT",
                      objectId: segment.id,
                      front: {
                        accessories: active
                          ? front.accessories.filter(
                              (item) => item !== accessory
                            )
                          : [...front.accessories, accessory]
                      }
                    })
                  }
                  className={CARD_CHIP_CLASS}
                >
                  {ACCESSORY_LABELS[accessory]}
                </button>
              );
            })}
          </div>
        </>
      )}

      {canEditSegmentKind(segment) && (
        <>
          <CardSectionLabel>KIND</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={segment.cabinetKind === option.value}
                onClick={() =>
                  dispatch({
                    type: "SET_SEGMENT_KIND",
                    objectId: segment.id,
                    cabinetKind: option.value
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}

      {canSlide && (
        <>
          <CardSectionLabel>SLIDE GROUP</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "NUDGE_GROUP",
                  objectId: segment.id,
                  direction: "left"
                })
              }
              className={CARD_CHIP_CLASS}
            >
              ← 1/16″
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "NUDGE_GROUP",
                  objectId: segment.id,
                  direction: "right"
                })
              }
              className={CARD_CHIP_CLASS}
            >
              1/16″ →
            </button>
          </div>
        </>
      )}

      {segment.anchored && (
        <>
          <CardSectionLabel>WINDOW ALIGNMENT</CardSectionLabel>
          {sinkOffset ? (
            <>
              <p className="mt-1.5 text-[9.5px] leading-4 text-[#815416]">
                Off the window center by {formatSixteenths(Math.abs(sinkOffset))}.
                Editing the cabinets beside it keeps it put; re-center to snap it
                back.
              </p>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "RECENTER_SINK", objectId: segment.id })
                }
                className="mt-1.5 w-full rounded-[8px] border border-studio-line bg-white px-2 py-1.5 font-mono text-[9px] text-studio-ink outline-none transition-colors hover:border-studio-ink"
              >
                Re-center under window
              </button>
            </>
          ) : (
            <p className="mt-1.5 text-[9.5px] leading-4 text-studio-muted">
              Centered under the window. Cabinet edits on either side are
              absorbed by that side&apos;s filler, so it stays put.
            </p>
          )}
        </>
      )}

      {isFiller && (
        <>
          <p className="mt-2 text-[9.5px] leading-4 text-studio-muted">
            Remainder space: its width is wall length minus the cabinets and
            settles automatically. Choose where it sits instead.
          </p>
          <CardSectionLabel>PLACEMENT</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {(
              [
                { placement: "start", label: "◀ Left end" },
                { placement: "split", label: "Split ends" },
                { placement: "end", label: "Right end ▶" }
              ] as const
            ).map((option) => (
              <button
                key={option.placement}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_FILLER_PLACEMENT",
                    objectId: segment.id,
                    placement: option.placement
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "REMOVE_FILLER", objectId: segment.id })
            }
            className="mt-2 w-full rounded-[8px] border border-[#c7d0ca] bg-[#f7faf8] px-2 py-1.5 font-mono text-[9px] text-studio-ink outline-none transition-colors hover:border-studio-ink"
          >
            Remove filler · keep open space
          </button>
          {/* Removing leaves the space open and the cabinets untouched, which
              is the default. Absorbing it into a neighbour is the second
              choice, so it sits below as a plain option. */}
          <MergeControls
            segment={segment}
            wall={wall}
            sectionLabel="OR ABSORB INTO A NEIGHBOUR"
            dispatch={dispatch}
          />
        </>
      )}

      {isIntentionalGap && (
        <>
          <p className="mt-2 text-[9.5px] leading-4 text-studio-muted">
            Open space is preserved at {formatSixteenths(segment.widthSixteenths)}.
            Cabinets beside it will not resize or shift.
          </p>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "RESTORE_FILLER", objectId: segment.id })
            }
            className="mt-2 w-full rounded-[8px] border border-studio-line bg-white px-2 py-1.5 font-mono text-[9px] text-studio-ink outline-none transition-colors hover:border-studio-ink"
          >
            Restore filler
          </button>
          <MergeControls
            segment={segment}
            wall={wall}
            sectionLabel="OR ABSORB INTO A NEIGHBOUR"
            dispatch={dispatch}
          />
        </>
      )}
    </div>
  );
}

export const CORNER_STRATEGY_OPTIONS: { value: CornerStrategy; label: string }[] = [
  { value: "lazySusan", label: "Lazy Susan" },
  { value: "diagonalCorner", label: "Diagonal Corner" },
  { value: "leMans", label: "LeMans" },
  { value: "blindBase", label: "Blind · none" },
  { value: "magicCorner", label: "Magic Corner" },
  { value: "blindCornerPullOut", label: "Blind pull-out" },
  { value: "cornerPullOutShelves", label: "Pull-out shelves" }
];

function CornerSetupControls({
  intentKey,
  segment,
  designIntent,
  dispatch
}: {
  intentKey: string;
  segment: WallSegment;
  designIntent?: Round2DesignIntent;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const selected =
    designIntent?.answers[intentKey] ?? inferCornerStrategy(segment);
  return (
    <>
      <CardSectionLabel>CORNER SETUP</CardSectionLabel>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {CORNER_STRATEGY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected === option.value}
            onClick={() =>
              dispatch({
                type: "SET_DESIGN_INTENT",
                key: intentKey,
                value: option.value
              })
            }
            className={CARD_CHIP_CLASS}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}

function cornerIntentKeyForSegment(segment: WallSegment): string | null {
  return segment.sourceCornerId ? `corner.${segment.sourceCornerId}.strategy` : null;
}

const FRIDGE_ABOVE_OPTIONS: { value: FridgeAboveStrategy; label: string }[] = [
  { value: "gap", label: "Open gap" },
  { value: "wallCabinet", label: "Wall cabinet" },
  { value: "panel", label: "Panel" }
];

const FRIDGE_SIDE_OPTIONS: { value: FridgeSideStrategy; label: string }[] = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both" }
];

/**
 * Fridge-specific setup, shown when the fridge tall unit (or one of its finished
 * side panels) is selected: what sits above the fridge and which exposed sides
 * carry a finished panel. Mirrors CornerSetupControls — the choice lives in
 * design intent and re-runs autofill live.
 */
function FridgeSetupControls({
  keys,
  designIntent,
  heightProfile,
  dispatch
}: {
  keys: { fixedPointId: string; above: string; sides: string; height: string };
  designIntent?: Round2DesignIntent;
  heightProfile: Round2HeightProfile;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const above = (designIntent?.answers[keys.above] as FridgeAboveStrategy) ?? "gap";
  const sides = (designIntent?.answers[keys.sides] as FridgeSideStrategy) ?? "both";
  // The above unit's height only matters once something is placed above the
  // fridge; a plain gap has no height to set.
  const aboveHeight = fridgeAboveHeightSixteenths(
    keys.fixedPointId,
    designIntent,
    heightProfile
  );
  return (
    <>
      <CardSectionLabel>ABOVE FRIDGE</CardSectionLabel>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {FRIDGE_ABOVE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={above === option.value}
            onClick={() =>
              dispatch({
                type: "SET_DESIGN_INTENT",
                key: keys.above,
                value: option.value
              })
            }
            className={CARD_CHIP_CLASS}
          >
            {option.label}
          </button>
        ))}
      </div>
      {above !== "gap" && (
        <>
          <CardSectionLabel>ABOVE HEIGHT</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-5 gap-1">
            {FRIDGE_ABOVE_HEIGHT_OPTIONS.map((height) => (
              <button
                key={height}
                type="button"
                aria-pressed={aboveHeight === height}
                onClick={() =>
                  dispatch({
                    type: "SET_DESIGN_INTENT",
                    key: keys.height,
                    value: height
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {height / 16}″
              </button>
            ))}
          </div>
          <InchField
            value={aboveHeight}
            onChange={(value) => {
              if (value != null && value > 0) {
                dispatch({
                  type: "SET_DESIGN_INTENT",
                  key: keys.height,
                  value
                });
              }
            }}
            ariaLabel="Custom above-fridge height"
          />
        </>
      )}
      <CardSectionLabel>SIDE PANELS</CardSectionLabel>
      <div className="mt-1.5 grid grid-cols-4 gap-1">
        {FRIDGE_SIDE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={sides === option.value}
            onClick={() =>
              dispatch({
                type: "SET_DESIGN_INTENT",
                key: keys.sides,
                value: option.value
              })
            }
            className={CARD_CHIP_CLASS}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Intent keys for a fridge tall unit or its finished panels. Both the fridge
 * appliance segment and its flanking panels resolve to the same fridge, so
 * clicking either opens the same controls.
 */
function fridgeIntentKeysForSegment(
  segment: WallSegment,
  wall: Round2Wall
): { fixedPointId: string; above: string; sides: string; height: string } | null {
  const point = wall.fixedPoints.find(
    (item) => item.id === segment.sourceFixedPointId
  );
  if (point?.symbol !== "fridge") return null;
  const isFridgeUnit =
    segment.kind === "panel" ||
    (segment.kind === "appliance" && segment.cabinetKind === "tall");
  if (!isFridgeUnit) return null;
  return {
    fixedPointId: point.id,
    above: fridgeAboveIntentKey(point.id),
    sides: fridgeSidesIntentKey(point.id),
    height: fridgeAboveHeightIntentKey(point.id)
  };
}

function inferCornerStrategy(segment: WallSegment): CornerStrategy {
  const accessories = segment.front?.accessories ?? [];
  if (accessories.includes("magicCorner")) return "magicCorner";
  if (accessories.includes("blindCornerPullOut")) return "blindCornerPullOut";
  if (accessories.includes("cornerPullOutShelves")) return "cornerPullOutShelves";
  if ((segment.code ?? segment.label).startsWith("LS")) return "lazySusan";
  if ((segment.code ?? segment.label).startsWith("DC")) return "diagonalCorner";
  if ((segment.code ?? segment.label).startsWith("LM")) return "leMans";
  if ((segment.code ?? segment.label).startsWith("BB")) return "blindBase";
  return "lazySusan";
}
