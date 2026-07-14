"use client";

import {
  formatSixteenths,
  type Round2Model,
  type Round2Wall,
  type WallId,
  type WallSegment
} from "../model/round2-model";
import { CABINET_STANDARDS } from "../model/cabinet-standards";
import { assignDimensionLanes } from "../model/dimension-lanes";
import { resolveSegmentRole, type SegmentRole } from "../model/segment-role";

// Read-only top-view projection drawn to the same sheet conventions as the
// elevation: teal dimension chains outside each wall (per-segment plus the
// wall total), solid base carcasses, dashed upper projections, and plan
// symbols instead of cabinet codes. The elevation owns every edit; this plan
// only mirrors the model and navigates the selection on click.

const VIEW = { left: 155, top: 150, right: 625, bottom: 495 };

// Strip depth in px for a 24″ base cabinet; uppers scale from the standards.
const BASE_DEPTH_PX = 52;
const PX_PER_SIXTEENTH =
  BASE_DEPTH_PX / CABINET_STANDARDS.depths.baseSixteenths;
const WALL_HALF = 6;
const CABINET_INSET_PX = 7;

const DIMENSION_COLOR = "#079ca5";
const DIMENSION_STROKE_WIDTH = 1.8;
const DIMENSION_FONT_SIZE = 10;
const TICK = 5;
const MIN_LABEL_PX = 30;
const LANE_STEP = 10;
// Offsets are measured outward from the wall centerline: opening tags hug the
// wall, the segment chain sits clear of them, staggered lanes for narrow
// segments step further out, and the wall total is the outermost line.
const OPENING_LABEL_OFFSET = 16;
const CHAIN_OFFSET = 30;
// Keep plan dimension rows on the same rhythm as the elevation rows
// (upper-to-base spacing is 22 SVG units there).
const DIMENSION_ROW_GAP = 22;
const DEPTH_ROW_GAP = 22;

const CABINET_FILL = "#ffffff";
const CARCASS_STROKE = "#1d1d1b";
const OPENING_COLOR = "#1d1d1b";
const UPPER_COLOR = "#1d1d1b";
const CORNER_ACCENT = "#1d1d1b";
const GLYPH_STROKE = "#1d1d1b";

function fillForSegment(segment: WallSegment) {
  return CABINET_FILL;
}

export function DesignPlan({
  model,
  selectedObjectId,
  onSelect
}: {
  model: Round2Model | null;
  selectedObjectId: string | null;
  onSelect: (id: string, wall: WallId) => void;
}) {
  const walls = model?.walls ?? [];
  const hasSegments = walls.some((wall) => wall.segments.length > 0);

  return (
    <div className="relative h-full min-h-[220px] overflow-hidden rounded-[18px] border border-studio-line bg-white shadow-[0_18px_42px_-30px_rgba(20,20,26,0.28)]">
      <div className="pointer-events-none absolute inset-0 opacity-100 [background-image:linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <svg
        viewBox="60 46 660 504"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Cabinet proposal top view"
        className="relative h-full w-full"
      >
        <g data-plan-drawing="true" transform="translate(50 15)">
        {walls.map((wall) => {
          const line = wallLine(wall);
          return (
            <path
              key={wall.id}
              d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
              stroke="#151515"
              strokeWidth={WALL_HALF * 2}
              strokeLinecap="square"
              fill="none"
            />
          );
        })}

        <CornerFootprints
          walls={walls}
          selectedObjectId={selectedObjectId}
          onSelect={onSelect}
        />

        {walls.map((wall) => (
          <SegmentRun
            key={wall.id}
            wall={wall}
            selectedObjectId={selectedObjectId}
            onSelect={onSelect}
          />
        ))}

        {walls.map((wall) => (
          <UpperOverlay key={wall.id} wall={wall} />
        ))}

        <UpperCornerFootprints walls={walls} />

        {walls.map((wall) => (
          <OpeningGlyphs key={wall.id} wall={wall} />
        ))}

        {walls.map((wall) => (
          <DimensionChains key={wall.id} wall={wall} />
        ))}

        <UpperCornerDimensions walls={walls} />

        {!hasSegments && (
          <text
            x="390"
            y="300"
            textAnchor="middle"
            fontFamily="var(--studio-mono)"
            fontSize="11"
            fill="#8b8b85"
          >
            SUBMIT MEASUREMENTS TO AUTOFILL
          </text>
        )}
        </g>
      </svg>
    </div>
  );
}

type CornerSide = "start" | "end";
type PlanCorner = "TL" | "TR" | "BL" | "BR";

type CornerFootprint = {
  id: string;
  corner: PlanCorner;
  wallsLabel: string;
  segmentId: string;
  wallId: WallId;
  selected: boolean;
  path: string;
  fill: string;
  glyphX: number;
  glyphY: number;
  horizontalLength: number;
  verticalLength: number;
  horizontalSixteenths: number;
  verticalSixteenths: number;
};

function CornerFootprints({
  walls,
  selectedObjectId,
  onSelect
}: {
  walls: Round2Wall[];
  selectedObjectId: string | null;
  onSelect: (id: string, wall: WallId) => void;
}) {
  const footprints = buildCornerFootprints(walls, selectedObjectId);
  if (footprints.length === 0) return null;

  return (
    <g data-plan-layer="corner-footprints">
      {footprints.map((footprint) => (
        <g
          key={footprint.id}
          data-segment-id={footprint.segmentId}
          data-cabinet-id={footprint.segmentId}
          data-selected={footprint.selected}
          onClick={() => onSelect(footprint.segmentId, footprint.wallId)}
          className="cursor-pointer"
        >
          <path
            data-plan-corner-footprint={footprint.id}
            data-plan-corner-walls={footprint.wallsLabel}
            d={footprint.path}
            fill={footprint.fill}
            stroke={footprint.selected ? "#079ca5" : CARCASS_STROKE}
            strokeWidth={footprint.selected ? 2.5 : 1.3}
            strokeLinejoin="round"
          />
          {/* Lazy-susan tray drawn to plan convention: a dashed circle in the
              corner square, replacing the code label. */}
          <circle
            data-plan-corner-glyph={footprint.id}
            cx={footprint.glyphX}
            cy={footprint.glyphY}
            r={BASE_DEPTH_PX * 0.3}
            fill="none"
            stroke={CORNER_ACCENT}
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
        </g>
      ))}
    </g>
  );
}

/**
 * Plan view calls out the two measured legs of a diagonal upper corner
 * cabinet. Cabinet depth is already documented in the elevation, so it is
 * deliberately not repeated here. Extension lines stop 10px from the
 * footprint, matching the short leaders used by the other dimension chains.
 */
function UpperCornerDimensions({ walls }: { walls: Round2Wall[] }) {
  const corners = buildUpperCornerDimensions(walls);
  if (corners.length === 0) return null;

  return (
    <g
      data-plan-layer="corner-dimensions"
      stroke={DIMENSION_COLOR}
      fill={DIMENSION_COLOR}
      fontFamily="var(--studio-mono)"
    >
      {corners.map((corner) => {
        const anchor = cornerAnchor(corner.corner);
        const sx = corner.corner === "TL" || corner.corner === "BL" ? 1 : -1;
        const sy = corner.corner === "TL" || corner.corner === "TR" ? 1 : -1;
        const wallY = anchor.y - sy * CABINET_INSET_PX;
        const wallX = anchor.x - sx * CABINET_INSET_PX;
        // Continue the 20px cadence used by the nearby 36″ dimension chains.
        const horizontalY = wallY - sy * 30;
        const verticalX = wallX - sx * 40;
        const horizontalEndX = anchor.x + sx * corner.horizontalLength;
        const verticalEndY = anchor.y + sy * corner.verticalLength;
        const horizontalLabelY = horizontalY - sy * 4;
        const verticalLabelX = verticalX - sx * 4;
        const horizontalLabelX = (anchor.x + horizontalEndX) / 2;
        const verticalLabelY = (anchor.y + verticalEndY) / 2;

        return (
          <g key={corner.id} data-plan-corner-dimension={corner.id}>
            <line
              data-plan-corner-dimension-horizontal={corner.id}
              x1={anchor.x}
              y1={horizontalY}
              x2={horizontalEndX}
              y2={horizontalY}
              strokeWidth={DIMENSION_STROKE_WIDTH}
            />
            <line
              data-plan-corner-dimension-vertical={corner.id}
              x1={verticalX}
              y1={anchor.y}
              x2={verticalX}
              y2={verticalEndY}
              strokeWidth={DIMENSION_STROKE_WIDTH}
            />
            <line
              data-plan-corner-extension={`${corner.id}-horizontal-start`}
              x1={anchor.x}
              y1={horizontalY}
              x2={anchor.x}
              y2={horizontalY + sy * 10}
              strokeWidth={DIMENSION_STROKE_WIDTH}
            />
            <line
              data-plan-corner-extension={`${corner.id}-horizontal-end`}
              x1={horizontalEndX}
              y1={horizontalY}
              x2={horizontalEndX}
              y2={horizontalY + sy * 10}
              strokeWidth={DIMENSION_STROKE_WIDTH}
            />
            <line
              data-plan-corner-extension={`${corner.id}-vertical-start`}
              x1={verticalX}
              y1={anchor.y}
              x2={verticalX + sx * 10}
              y2={anchor.y}
              strokeWidth={DIMENSION_STROKE_WIDTH}
            />
            <line
              data-plan-corner-extension={`${corner.id}-vertical-end`}
              x1={verticalX}
              y1={verticalEndY}
              x2={verticalX + sx * 10}
              y2={verticalEndY}
              strokeWidth={DIMENSION_STROKE_WIDTH}
            />
            <text
              data-plan-corner-label-horizontal={corner.id}
              x={horizontalLabelX}
              y={horizontalLabelY}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              stroke="none"
            >
              {formatSixteenths(corner.horizontalSixteenths)}
            </text>
            <text
              data-plan-corner-label-vertical={corner.id}
              x={verticalLabelX}
              y={verticalLabelY}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              stroke="none"
              transform={`rotate(-90 ${verticalLabelX} ${verticalLabelY})`}
            >
              {formatSixteenths(corner.verticalSixteenths)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

type UpperCornerDimension = {
  id: string;
  corner: PlanCorner;
  horizontalLength: number;
  verticalLength: number;
  horizontalSixteenths: number;
  verticalSixteenths: number;
};

function buildUpperCornerDimensions(walls: Round2Wall[]): UpperCornerDimension[] {
  const corners = new Map<
    string,
    {
      corner: PlanCorner;
      runs: Partial<Record<"horizontal" | "vertical", number>>;
      values: Partial<Record<"horizontal" | "vertical", number>>;
    }
  >();

  for (const wall of walls) {
    const upper = wall.segments.filter((segment) => segment.tier === "upper");
    const total =
      wall.lengthSixteenths ??
      (upper.reduce((sum, segment) => sum + Math.max(0, segment.widthSixteenths), 0) ||
        1);
    for (const segment of upper) {
      if (!segment.sourceCornerId || !/^WDC\d+/i.test(segment.label.trim())) {
        continue;
      }
      const corner = planCornerFromId(segment.sourceCornerId);
      if (!corner) continue;
      const axis = isHorizontalWall(wall) ? "horizontal" : "vertical";
      const entry = corners.get(segment.sourceCornerId) ?? {
        corner,
        runs: {},
        values: {}
      };
      entry.runs[axis] =
        (Math.max(0, segment.widthSixteenths) / total) * wallRunLength(wall);
      entry.values[axis] = segment.widthSixteenths;
      corners.set(segment.sourceCornerId, entry);
    }
  }

  const fallback = CABINET_STANDARDS.depths.upperSixteenths;
  return [...corners.entries()].map(([id, { corner, runs, values }]) => ({
    id,
    corner,
    horizontalLength: runs.horizontal ?? runs.vertical ?? fallback * PX_PER_SIXTEENTH,
    verticalLength: runs.vertical ?? runs.horizontal ?? fallback * PX_PER_SIXTEENTH,
    horizontalSixteenths: values.horizontal ?? values.vertical ?? fallback,
    verticalSixteenths: values.vertical ?? values.horizontal ?? fallback
  }));
}

function buildCornerFootprints(
  walls: Round2Wall[],
  selectedObjectId: string | null
): CornerFootprint[] {
  const cornerIds = new Set<string>();
  for (const wall of walls) {
    for (const segment of wall.segments) {
      if (isLazySusanFootprintSegment(segment)) {
        cornerIds.add(segment.sourceCornerId);
      }
    }
  }

  return [...cornerIds].flatMap((cornerId) => {
    const entries = walls
      .map((wall) => cornerWallEntry(wall, cornerId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    if (entries.length === 0) return [];

    const corner = resolvePlanCorner(entries);
    if (!corner) return [];
    const horizontal = entries.find(
      (entry) =>
        entry.wall.sourceWall === "TOP" || entry.wall.sourceWall === "BOTTOM"
    );
    const vertical = entries.find(
      (entry) =>
        entry.wall.sourceWall === "LEFT" || entry.wall.sourceWall === "RIGHT"
    );
    const horizontalLength = horizontal?.lengthPx ?? BASE_DEPTH_PX;
    const verticalLength = vertical?.lengthPx ?? BASE_DEPTH_PX;
    const representative =
      entries
        .flatMap((entry) => entry.segments)
        .find((segment) => segment.cabinetKind === "corner") ??
      entries.flatMap((entry) => entry.segments)[0];
    const anchor = cornerAnchor(corner);
    const glyph = cornerGlyphPoint(corner, anchor);

    return [
      {
        id: cornerId,
        corner,
        wallsLabel: entries.map((entry) => entry.wall.sourceWall).join(","),
        segmentId: representative.id,
        wallId: representative.wallId,
        selected: entries.some((entry) =>
          entry.segments.some((segment) => segment.id === selectedObjectId)
        ),
        path: cornerPath(corner, anchor, horizontalLength, verticalLength),
        fill: fillForSegment(representative),
        glyphX: glyph.x,
        glyphY: glyph.y,
        horizontalLength,
        verticalLength,
        horizontalSixteenths:
          horizontal?.widthSixteenths ?? CABINET_STANDARDS.depths.baseSixteenths,
        verticalSixteenths:
          vertical?.widthSixteenths ?? CABINET_STANDARDS.depths.baseSixteenths
      }
    ];
  });
}

function cornerWallEntry(wall: Round2Wall, cornerId: string) {
  const segments = wall.segments.filter(
    (segment) =>
      segment.tier !== "upper" &&
      segment.sourceCornerId === cornerId &&
      isLazySusanFootprintSegment(segment)
  );
  if (segments.length === 0) return null;
  const side = cornerSide(wall, cornerId);
  const measuredTotal =
    wall.lengthSixteenths ??
    wall.segments
      .filter((segment) => segment.tier !== "upper")
      .reduce((sum, segment) => sum + segment.widthSixteenths, 0);
  const total = measuredTotal || 1;
  const width = segments.reduce(
    (sum, segment) => sum + Math.max(0, segment.widthSixteenths),
    0
  );
  return {
    wall,
    side,
    segments,
    widthSixteenths: width,
    lengthPx: (width / total) * wallRunLength(wall)
  };
}

function cornerSide(wall: Round2Wall, cornerId: string): CornerSide {
  const base = wall.segments.filter((segment) => segment.tier !== "upper");
  const firstIndex = base.findIndex(
    (segment) => segment.sourceCornerId === cornerId
  );
  let lastIndex = -1;
  for (let index = base.length - 1; index >= 0; index--) {
    if (base[index].sourceCornerId === cornerId) {
      lastIndex = index;
      break;
    }
  }
  const before = base
    .slice(0, Math.max(0, firstIndex))
    .reduce((sum, segment) => sum + Math.max(0, segment.widthSixteenths), 0);
  const after = base
    .slice(lastIndex + 1)
    .reduce((sum, segment) => sum + Math.max(0, segment.widthSixteenths), 0);
  return before <= after ? "start" : "end";
}

function resolvePlanCorner(
  entries: { wall: Round2Wall; side: CornerSide }[]
): PlanCorner | null {
  for (const entry of entries) {
    const corner = cornerForWallSide(entry.wall.sourceWall, entry.side);
    if (corner) return corner;
  }
  return null;
}

function cornerForWallSide(
  sourceWall: Round2Wall["sourceWall"],
  side: CornerSide
): PlanCorner | null {
  if (sourceWall === "TOP") return side === "start" ? "TL" : "TR";
  if (sourceWall === "LEFT") return side === "start" ? "TL" : "BL";
  if (sourceWall === "RIGHT") return side === "start" ? "TR" : "BR";
  if (sourceWall === "BOTTOM") return side === "start" ? "BL" : "BR";
  return null;
}

function cornerAnchor(corner: PlanCorner): { x: number; y: number } {
  if (corner === "TL") return { x: VIEW.left + 7, y: VIEW.top + 7 };
  if (corner === "TR") return { x: VIEW.right - 7, y: VIEW.top + 7 };
  if (corner === "BL") return { x: VIEW.left + 7, y: VIEW.bottom - 7 };
  return { x: VIEW.right - 7, y: VIEW.bottom - 7 };
}

function cornerPath(
  corner: PlanCorner,
  anchor: { x: number; y: number },
  horizontalLength: number,
  verticalLength: number
): string {
  const d = BASE_DEPTH_PX;
  const { x, y } = anchor;
  if (corner === "TL") {
    return pathFromPoints([
      [x, y],
      [x + horizontalLength, y],
      [x + horizontalLength, y + d],
      [x + d, y + d],
      [x + d, y + verticalLength],
      [x, y + verticalLength]
    ]);
  }
  if (corner === "TR") {
    return pathFromPoints([
      [x, y],
      [x - horizontalLength, y],
      [x - horizontalLength, y + d],
      [x - d, y + d],
      [x - d, y + verticalLength],
      [x, y + verticalLength]
    ]);
  }
  if (corner === "BL") {
    return pathFromPoints([
      [x, y],
      [x + horizontalLength, y],
      [x + horizontalLength, y - d],
      [x + d, y - d],
      [x + d, y - verticalLength],
      [x, y - verticalLength]
    ]);
  }
  return pathFromPoints([
    [x, y],
    [x - horizontalLength, y],
    [x - horizontalLength, y - d],
    [x - d, y - d],
    [x - d, y - verticalLength],
    [x, y - verticalLength]
  ]);
}

function pathFromPoints(points: [number, number][]): string {
  return `${points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${planNumber(x)} ${planNumber(y)}`)
    .join(" ")} Z`;
}

function cornerGlyphPoint(
  corner: PlanCorner,
  anchor: { x: number; y: number }
): { x: number; y: number } {
  const offset = BASE_DEPTH_PX / 2;
  if (corner === "TL") return { x: anchor.x + offset, y: anchor.y + offset };
  if (corner === "TR") return { x: anchor.x - offset, y: anchor.y + offset };
  if (corner === "BL") return { x: anchor.x + offset, y: anchor.y - offset };
  return { x: anchor.x - offset, y: anchor.y - offset };
}

function SegmentRun({
  wall,
  selectedObjectId,
  onSelect
}: {
  wall: Round2Wall;
  selectedObjectId: string | null;
  onSelect: (id: string, wall: WallId) => void;
}) {
  const segments = wall.segments.filter((segment) => segment.tier !== "upper");
  const total =
    wall.lengthSixteenths ??
    (segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0) || 1);
  const available = wallRunLength(wall);
  let cursor = 0;

  return (
    <g>
      {segments.map((segment) => {
        const safeWidth = Math.max(0, segment.widthSixteenths);
        const length = (safeWidth / total) * available;
        const depth = depthPx(segment);
        const rect = segmentRect(wall, cursor, length, depth);
        cursor += length;
        if (!shouldRenderPlanSegment(segment)) return null;
        const selected = segment.id === selectedObjectId;
        const cornerGap = isCornerGap(segment);
        const role = resolveSegmentRole(segment, wall);
        return (
          <g
            key={segment.id}
            data-segment-id={segment.id}
            data-cabinet-id={segment.id}
            data-selected={selected}
            data-plan-corner-gap={cornerGap || undefined}
            onClick={() => onSelect(segment.id, wall.id)}
            className="cursor-pointer"
          >
            <title>{segment.code ?? segment.label}</title>
            <rect
              x={rect.x}
              y={rect.y}
              width={Math.max(6, rect.width)}
              height={Math.max(6, rect.height)}
              fill={fillForSegment(segment)}
              stroke={selected ? "#079ca5" : cornerGap ? CORNER_ACCENT : CARCASS_STROKE}
              strokeWidth={selected ? 2.5 : 1.2}
              strokeDasharray={cornerGap ? "5 3" : undefined}
            />
            {role && (
              <PlanApplianceGlyph
                role={role}
                x={rect.x}
                y={rect.y}
                width={Math.max(6, rect.width)}
                height={Math.max(6, rect.height)}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Appliances read from their plan symbol instead of a code label: burners for
 * the range, bowls for the sink, a dashed front for the dishwasher, a split
 * double door for the refrigerator.
 */
function PlanApplianceGlyph({
  role,
  x,
  y,
  width,
  height
}: {
  role: SegmentRole;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const cx = x + width / 2;
  const cy = y + height / 2;

  if (role === "range") {
    const dx = width * 0.22;
    const dy = height * 0.22;
    const r = Math.min(width, height) * 0.14;
    return (
      <g data-plan-glyph="range" stroke={GLYPH_STROKE} fill="none" strokeWidth="1.1">
        <circle cx={cx - dx} cy={cy - dy} r={r} />
        <circle cx={cx + dx} cy={cy - dy} r={r} />
        <circle cx={cx - dx} cy={cy + dy} r={r} />
        <circle cx={cx + dx} cy={cy + dy} r={r} />
      </g>
    );
  }

  if (role === "sink") {
    const long = Math.max(width, height);
    const doubleBowl = long >= 64;
    const inset = 8;
    const bowls: { bx: number; by: number; bw: number; bh: number }[] = [];
    if (!doubleBowl) {
      bowls.push({
        bx: x + inset,
        by: y + inset,
        bw: width - inset * 2,
        bh: height - inset * 2
      });
    } else if (width >= height) {
      const bw = (width - inset * 2 - 5) / 2;
      bowls.push(
        { bx: x + inset, by: y + inset, bw, bh: height - inset * 2 },
        { bx: x + inset + bw + 5, by: y + inset, bw, bh: height - inset * 2 }
      );
    } else {
      const bh = (height - inset * 2 - 5) / 2;
      bowls.push(
        { bx: x + inset, by: y + inset, bw: width - inset * 2, bh },
        { bx: x + inset, by: y + inset + bh + 5, bw: width - inset * 2, bh }
      );
    }
    return (
      <g data-plan-glyph="sink" stroke={GLYPH_STROKE} fill="none" strokeWidth="1.1">
        {bowls.map((bowl, index) => (
          <rect
            key={index}
            x={bowl.bx}
            y={bowl.by}
            width={Math.max(4, bowl.bw)}
            height={Math.max(4, bowl.bh)}
            rx="4"
          />
        ))}
      </g>
    );
  }

  if (role === "dishwasher") {
    return (
      <g data-plan-glyph="dishwasher" stroke={GLYPH_STROKE} fill="none" strokeWidth="1.1">
        <rect
          x={x + 6}
          y={y + 6}
          width={Math.max(4, width - 12)}
          height={Math.max(4, height - 12)}
        />
        <circle cx={cx} cy={cy} r="3.2" />
      </g>
    );
  }

  if (role === "fridge" || role === "oven" || role === "microwave") {
    const splitVertical = width >= height;
    return (
      <g data-plan-glyph={role} stroke={GLYPH_STROKE} fill="none" strokeWidth="1.1">
        <rect
          x={x + 5}
          y={y + 5}
          width={Math.max(4, width - 10)}
          height={Math.max(4, height - 10)}
        />
        {role === "fridge" &&
          (splitVertical ? (
            <line x1={cx} y1={y + 5} x2={cx} y2={y + height - 5} />
          ) : (
            <line x1={x + 5} y1={cy} x2={x + width - 5} y2={cy} />
          ))}
      </g>
    );
  }

  return null;
}

/**
 * Upper run projected as a dashed half-depth outline over the base strip.
 * Fillers keep their spot in the dashed chain; diagonal corner uppers are
 * drawn by UpperCornerFootprints, so both they and their return clearance
 * only advance the cursor here.
 */
function UpperOverlay({ wall }: { wall: Round2Wall }) {
  const segments = wall.segments.filter((segment) => segment.tier === "upper");
  if (segments.length === 0) return null;
  const total =
    wall.lengthSixteenths ??
    (segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0) || 1);
  const available = wallRunLength(wall);
  let cursor = 0;

  return (
    <g data-plan-layer="upper-overlay" className="pointer-events-none">
      {segments.map((segment) => {
        const length = (Math.max(0, segment.widthSixteenths) / total) * available;
        const rect = segmentRect(wall, cursor, length, depthPx(segment));
        cursor += length;
        if (isDiagonalUpperFootprintSegment(segment)) return null;
        if (
          segment.kind !== "cabinet" &&
          segment.kind !== "filler" &&
          segment.kind !== "panel"
        ) {
          return null;
        }
        const filler = segment.kind === "filler";
        const panel = segment.kind === "panel";
        return (
          <rect
            key={segment.id}
            data-plan-upper={filler ? "filler" : panel ? "panel" : "cabinet"}
            x={rect.x}
            y={rect.y}
            width={Math.max(filler ? 2 : 4, rect.width)}
            height={Math.max(4, rect.height)}
            fill="none"
            stroke={UPPER_COLOR}
            strokeWidth={filler ? 1 : panel ? 1.1 : 1.3}
            strokeDasharray={filler ? "3 2" : panel ? "4 3" : "5 3"}
          />
        );
      })}
    </g>
  );
}

/**
 * Diagonal corner wall cabinet drawn to plan convention: a pentagon at upper
 * depth on both walls with a chamfered front, dashed like the rest of the
 * upper projection.
 */
function UpperCornerFootprints({ walls }: { walls: Round2Wall[] }) {
  const corners = new Map<
    string,
    { corner: PlanCorner; runs: Partial<Record<"horizontal" | "vertical", number>> }
  >();

  for (const wall of walls) {
    const total =
      wall.lengthSixteenths ??
      (wall.segments
        .filter((segment) => segment.tier === "upper")
        .reduce((sum, segment) => sum + Math.max(0, segment.widthSixteenths), 0) ||
        1);
    for (const segment of wall.segments) {
      if (
        segment.tier !== "upper" ||
        !segment.sourceCornerId ||
        !/^WDC\d+/i.test(segment.label.trim())
      ) {
        continue;
      }
      const corner = planCornerFromId(segment.sourceCornerId);
      if (!corner) continue;
      const entry =
        corners.get(segment.sourceCornerId) ?? { corner, runs: {} };
      entry.runs[isHorizontalWall(wall) ? "horizontal" : "vertical"] =
        (Math.max(0, segment.widthSixteenths) / total) * wallRunLength(wall);
      corners.set(segment.sourceCornerId, entry);
    }
  }
  if (corners.size === 0) return null;

  const depth = CABINET_STANDARDS.depths.upperSixteenths * PX_PER_SIXTEENTH;

  return (
    <g data-plan-layer="upper-corner-footprints" className="pointer-events-none">
      {[...corners.entries()].map(([cornerId, { corner, runs }]) => {
        const anchor = cornerAnchor(corner);
        const horizontal = runs.horizontal ?? runs.vertical ?? depth;
        const vertical = runs.vertical ?? runs.horizontal ?? depth;
        const sx = corner === "TL" || corner === "BL" ? 1 : -1;
        const sy = corner === "TL" || corner === "TR" ? 1 : -1;
        const points: [number, number][] = [
          [anchor.x, anchor.y],
          [anchor.x + sx * horizontal, anchor.y],
          [anchor.x + sx * horizontal, anchor.y + sy * depth],
          [anchor.x + sx * depth, anchor.y + sy * vertical],
          [anchor.x, anchor.y + sy * vertical]
        ];
        return (
          <path
            key={cornerId}
            data-plan-upper-corner={cornerId}
            d={pathFromPoints(points)}
            fill="none"
            stroke={UPPER_COLOR}
            strokeWidth="1.3"
            strokeDasharray="5 3"
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

function planCornerFromId(cornerId: string): PlanCorner | null {
  return cornerId === "TL" ||
    cornerId === "TR" ||
    cornerId === "BL" ||
    cornerId === "BR"
    ? cornerId
    : null;
}

/**
 * Windows and doors drawn to plan convention: the wall poché breaks, a window
 * keeps its frame with a glass line, a door shows leaf and swing arc into the
 * room. The tag next to the wall carries the measured width.
 */
function OpeningGlyphs({ wall }: { wall: Round2Wall }) {
  const points = wall.fixedPoints.filter(
    (point) => point.type === "window" || point.type === "door"
  );
  if (points.length === 0) return null;
  const line = wallLine(wall);
  const horizontal = isHorizontalWall(wall);
  const inward = inwardVector(wall);

  return (
    <g data-plan-layer="openings">
      {points.map((point) => {
        const length = wall.lengthSixteenths;
        const startRatio =
          length && point.offsetSixteenths != null
            ? point.offsetSixteenths / length
            : point.positionRatio;
        const widthRatio =
          length && point.widthSixteenths ? point.widthSixteenths / length : 0.12;
        const start = pointOnLine(line, clamp01(startRatio));
        const end = pointOnLine(line, clamp01(startRatio + widthRatio));
        const band = horizontal
          ? {
              x: Math.min(start.x, end.x),
              y: line.y1 - WALL_HALF,
              width: Math.abs(end.x - start.x),
              height: WALL_HALF * 2
            }
          : {
              x: line.x1 - WALL_HALF,
              y: Math.min(start.y, end.y),
              width: WALL_HALF * 2,
              height: Math.abs(end.y - start.y)
            };
        const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const label = point.widthSixteenths
          ? `${point.label.toUpperCase()} · ${formatSixteenths(point.widthSixteenths)}`
          : point.label.toUpperCase();
        const labelPos = offsetPoint(mid, wall, OPENING_LABEL_OFFSET);
        const rotate = horizontal
          ? undefined
          : `rotate(${wall.sourceWall === "RIGHT" ? 90 : -90} ${labelPos.x} ${labelPos.y})`;

        return (
          <g key={point.id} data-plan-opening={point.type}>
            <rect
              x={band.x}
              y={band.y}
              width={band.width}
              height={band.height}
              fill="#ffffff"
              stroke={OPENING_COLOR}
              strokeWidth="1"
            />
            {point.type === "window" ? (
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={OPENING_COLOR}
                strokeWidth="1.4"
              />
            ) : (
              <DoorSwing start={start} end={end} inward={inward} />
            )}
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              fontFamily="var(--studio-mono)"
              fontSize="7"
              letterSpacing="0.08em"
              fill={OPENING_COLOR}
              transform={rotate}
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function DoorSwing({
  start,
  end,
  inward
}: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  inward: { x: number; y: number };
}) {
  const radius = Math.hypot(end.x - start.x, end.y - start.y);
  if (radius < 4) return null;
  const leafTip = {
    x: start.x + inward.x * radius,
    y: start.y + inward.y * radius
  };
  const cross =
    (end.x - start.x) * inward.y - (end.y - start.y) * inward.x;
  const sweep = cross > 0 ? 1 : 0;
  return (
    <g stroke={OPENING_COLOR} fill="none" strokeWidth="1.2">
      <line x1={start.x} y1={start.y} x2={leafTip.x} y2={leafTip.y} />
      <path
        d={`M ${planNumber(end.x)} ${planNumber(end.y)} A ${planNumber(radius)} ${planNumber(radius)} 0 0 ${sweep} ${planNumber(leafTip.x)} ${planNumber(leafTip.y)}`}
        strokeDasharray="4 3"
      />
    </g>
  );
}

/**
 * Two teal chains outside each wall, matching the elevation sheet: the inner
 * chain dimensions every base-run segment (narrow segments stagger to outer
 * lanes with a leader), the outer line carries the wall total.
 */
function DimensionChains({ wall }: { wall: Round2Wall }) {
  const base = wall.segments.filter((segment) => segment.tier !== "upper");
  if (base.length === 0) return null;
  const total =
    wall.lengthSixteenths ??
    (base.reduce((sum, segment) => sum + segment.widthSixteenths, 0) || 1);
  const available = wallRunLength(wall);
  const widths = base.map(
    (segment) => (Math.max(0, segment.widthSixteenths) / total) * available
  );
  const lanes = assignDimensionLanes(widths, MIN_LABEL_PX);
  const runEnd = widths.reduce((sum, width) => sum + width, 0);
  const horizontal = isHorizontalWall(wall);
  const textPad = wall.sourceWall === "BOTTOM" ? 14 : horizontal ? 6 : 4;
  // Reserve 20px lanes for the two depth callouts. This keeps the left-side
  // columns (wall total, segment, base depth, upper depth, wall) even, while
  // the top-side rows follow the same rhythm.
  const chainOffset =
    wall.sourceWall === "LEFT" ? 60 : wall.sourceWall === "TOP" ? 50 : CHAIN_OFFSET;

  const boundaries: number[] = [0];
  let cursor = 0;
  for (const width of widths) {
    cursor += width;
    boundaries.push(cursor);
  }

  const chainA = runPoint(wall, 0, chainOffset);
  const chainB = runPoint(wall, runEnd, chainOffset);
  const overallOffset = chainOffset + DIMENSION_ROW_GAP;
  const overallA = runPoint(wall, 0, overallOffset);
  const overallB = runPoint(wall, runEnd, overallOffset);
  const overallMid = runPoint(wall, runEnd / 2, overallOffset + textPad);
  const overallRotate = horizontal
    ? undefined
    : `rotate(${wall.sourceWall === "RIGHT" ? 90 : -90} ${overallMid.x} ${overallMid.y})`;

  let mid = 0;

  return (
    <g
      data-plan-layer="dimension-chain"
      data-plan-chain-wall={wall.id}
      stroke={DIMENSION_COLOR}
      fill={DIMENSION_COLOR}
      fontFamily="var(--studio-mono)"
    >
      <line
        data-plan-overall-line={wall.id}
        x1={overallA.x}
        y1={overallA.y}
        x2={overallB.x}
        y2={overallB.y}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <line
        data-plan-overall-tick-start={wall.id}
        x1={runPoint(wall, 0, overallOffset - TICK).x}
        y1={runPoint(wall, 0, overallOffset - TICK).y}
        x2={runPoint(wall, 0, overallOffset + TICK).x}
        y2={runPoint(wall, 0, overallOffset + TICK).y}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <line
        data-plan-overall-tick-end={wall.id}
        x1={runPoint(wall, runEnd, overallOffset - TICK).x}
        y1={runPoint(wall, runEnd, overallOffset - TICK).y}
        x2={runPoint(wall, runEnd, overallOffset + TICK).x}
        y2={runPoint(wall, runEnd, overallOffset + TICK).y}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <text
        data-plan-overall-label={wall.id}
        x={overallMid.x}
        y={overallMid.y}
        textAnchor="middle"
        fontSize={DIMENSION_FONT_SIZE}
        fontWeight="bold"
        stroke="none"
        transform={overallRotate}
      >
        {wall.id} · {formatSixteenths(total)}
      </text>
      <line
        x1={chainA.x}
        y1={chainA.y}
        x2={chainB.x}
        y2={chainB.y}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      {boundaries.map((position, index) => {
        const from = runPoint(wall, position, chainOffset - TICK);
        const to = runPoint(wall, position, chainOffset + TICK);
        return (
          <line
            key={`tick-${index}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            strokeWidth={DIMENSION_STROKE_WIDTH}
          />
        );
      })}
      {base.map((segment, index) => {
        const width = widths[index];
        mid = boundaries[index] + width / 2;
        if (width <= 2) return null;
        const lane = lanes[index];
        const labelOffset = chainOffset + textPad + lane * LANE_STEP;
        const pos = runPoint(wall, mid, labelOffset);
        const rotate = horizontal
          ? undefined
          : `rotate(${wall.sourceWall === "RIGHT" ? 90 : -90} ${pos.x} ${pos.y})`;
        return (
          <g key={segment.id}>
            {lane > 0 && (
              <line
                x1={runPoint(wall, mid, chainOffset).x}
                y1={runPoint(wall, mid, chainOffset).y}
                x2={runPoint(wall, mid, labelOffset - 3).x}
                y2={runPoint(wall, mid, labelOffset - 3).y}
                strokeWidth="0.8"
              />
            )}
            <text
              data-chain-label={segment.id}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              fontSize={DIMENSION_FONT_SIZE}
              fontWeight="bold"
              stroke="none"
              transform={rotate}
            >
              {formatSixteenths(segment.widthSixteenths)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * Two independent depth dimensions per wall. Each starts at the cabinet back
 * and reaches its own front edge, so the 12″ upper and 24″ base lengths stay
 * visually proportional and their extension lines land on the cabinet edges.
 */
function DepthDimension({ wall }: { wall: Round2Wall }) {
  const hasBase = wall.segments.some(
    (segment) =>
      segment.tier !== "upper" &&
      (segment.kind === "cabinet" || segment.kind === "appliance")
  );
  if (!hasBase) return null;

  const CABINET_INSET = 7;
  const baseDepth = CABINET_STANDARDS.depths.baseSixteenths;
  const upperDepth = CABINET_STANDARDS.depths.upperSixteenths;
  const baseDepthPx = baseDepth * PX_PER_SIXTEENTH;
  const upperDepthPx = upperDepth * PX_PER_SIXTEENTH;
  if (wall.sourceWall === "TOP") {
    const backY = VIEW.top + CABINET_INSET;
    const upperFrontY = backY + upperDepthPx;
    const baseFrontY = backY + baseDepthPx;
    const anchorX = VIEW.left + CABINET_INSET;
    const dimensions = [
      {
        id: "upper",
        value: upperDepth,
        x: VIEW.left - 20,
        endY: upperFrontY
      },
      {
        id: "base",
        value: baseDepth,
        x: VIEW.left - 20 - DEPTH_ROW_GAP,
        endY: baseFrontY
      }
    ] as const;

    return (
      <DepthDimensionGroup wall={wall}>
        {dimensions.map((dimension) => {
          const labelY = (backY + dimension.endY) / 2;
          return (
            <g key={dimension.id} data-plan-depth-measure={dimension.id}>
              <line
                data-plan-depth-line={dimension.id}
                x1={dimension.x}
                y1={backY}
                x2={dimension.x}
                y2={dimension.endY}
                strokeWidth={DIMENSION_STROKE_WIDTH}
              />
              {[backY, dimension.endY].map((y) => (
                <line
                  key={y}
                  x1={dimension.x}
                  y1={y}
                  x2={anchorX}
                  y2={y}
                  strokeWidth="0.8"
                />
              ))}
              <text
                {...depthLabelAttributes(wall.id, dimension.id)}
                x={dimension.x}
                y={labelY}
                textAnchor="middle"
                fontSize="8"
                fontWeight="bold"
                stroke="none"
                transform={`rotate(-90 ${dimension.x} ${labelY})`}
              >
                {formatSixteenths(dimension.value)}
              </text>
            </g>
          );
        })}
      </DepthDimensionGroup>
    );
  }

  if (wall.sourceWall === "LEFT") {
    const backX = VIEW.left + CABINET_INSET;
    const upperFrontX = backX + upperDepthPx;
    const baseFrontX = backX + baseDepthPx;
    const anchorY = VIEW.top + CABINET_INSET;
    const dimensions = [
      {
        id: "upper",
        value: upperDepth,
        y: VIEW.top - 10,
        endX: upperFrontX
      },
      {
        id: "base",
        value: baseDepth,
        y: VIEW.top - 10 - DEPTH_ROW_GAP,
        endX: baseFrontX
      }
    ] as const;

    return (
      <DepthDimensionGroup wall={wall}>
        {dimensions.map((dimension) => {
          const labelX = (backX + dimension.endX) / 2;
          return (
            <g key={dimension.id} data-plan-depth-measure={dimension.id}>
              <line
                data-plan-depth-line={dimension.id}
                x1={backX}
                y1={dimension.y}
                x2={dimension.endX}
                y2={dimension.y}
                strokeWidth={DIMENSION_STROKE_WIDTH}
              />
              {[backX, dimension.endX].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1={dimension.y}
                  x2={x}
                  y2={anchorY}
                  strokeWidth="0.8"
                />
              ))}
              <text
                {...depthLabelAttributes(wall.id, dimension.id)}
                x={labelX}
                y={dimension.y - 4}
                textAnchor="middle"
                fontSize="8"
                fontWeight="bold"
                stroke="none"
              >
                {formatSixteenths(dimension.value)}
              </text>
            </g>
          );
        })}
      </DepthDimensionGroup>
    );
  }

  return (
    null
  );
}

function DepthDimensionGroup({
  wall,
  children
}: {
  wall: Round2Wall;
  children: React.ReactNode;
}) {
  return (
    <g
      data-plan-layer="depth-dimension"
      data-plan-depth-wall={wall.id}
      stroke={DIMENSION_COLOR}
      fill={DIMENSION_COLOR}
      fontFamily="var(--studio-mono)"
    >
      {children}
    </g>
  );
}

function depthLabelAttributes(wallId: WallId, kind: "upper" | "base") {
  return kind === "upper"
    ? { "data-plan-depth-upper": wallId }
    : { "data-plan-depth-base": wallId };
}

function depthPx(segment: WallSegment): number {
  const depths = CABINET_STANDARDS.depths;
  const sixteenths =
    segment.tier === "upper"
      ? depths.upperSixteenths
      : segment.cabinetKind === "tall"
        ? depths.tallSixteenths
        : depths.baseSixteenths;
  return sixteenths * PX_PER_SIXTEENTH;
}

function shouldRenderPlanSegment(segment: WallSegment): boolean {
  if (isLazySusanFootprintSegment(segment)) return false;
  if (segment.kind === "opening") return false;
  // The blind-base body reservation duplicates the corner square already
  // covered by the blind cabinet's own rectangle on the primary wall.
  if (segment.kind === "gap") {
    return isCornerGap(segment) && !isBlindCornerBodyGap(segment);
  }
  return true;
}

function isBlindCornerBodyGap(segment: WallSegment): boolean {
  return segment.kind === "gap" && segment.label === "Blind corner";
}

function isCornerGap(segment: WallSegment): boolean {
  return segment.kind === "gap" && Boolean(segment.sourceCornerId);
}

function isLazySusanFootprintSegment(segment: WallSegment): segment is WallSegment & {
  sourceCornerId: string;
} {
  if (segment.tier === "upper" || !segment.sourceCornerId) return false;
  return /^LS\d+/i.test(segment.label.trim());
}

/** Diagonal corner uppers render as a pentagon, not a straight dashed rect. */
function isDiagonalUpperFootprintSegment(segment: WallSegment): boolean {
  return (
    segment.tier === "upper" &&
    Boolean(segment.sourceCornerId) &&
    /^WDC\d+/i.test(segment.label.trim())
  );
}

function isHorizontalWall(wall: Round2Wall): boolean {
  return wall.sourceWall === "TOP" || wall.sourceWall === "BOTTOM";
}

function inwardVector(wall: Round2Wall): { x: number; y: number } {
  if (wall.sourceWall === "TOP") return { x: 0, y: 1 };
  if (wall.sourceWall === "BOTTOM") return { x: 0, y: -1 };
  if (wall.sourceWall === "LEFT") return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

/**
 * Maps a run position (px from the run start) and an outward offset from the
 * wall centerline (px, positive leaves the room) to view coordinates.
 */
function runPoint(
  wall: Round2Wall,
  t: number,
  offset: number
): { x: number; y: number } {
  if (wall.sourceWall === "TOP") {
    return { x: VIEW.left + 7 + t, y: VIEW.top - offset };
  }
  if (wall.sourceWall === "BOTTOM") {
    return { x: VIEW.left + 7 + t, y: VIEW.bottom + offset };
  }
  if (wall.sourceWall === "LEFT") {
    return { x: VIEW.left - offset, y: VIEW.top + 7 + t };
  }
  return { x: VIEW.right + offset, y: VIEW.top + 7 + t };
}

function offsetPoint(
  point: { x: number; y: number },
  wall: Round2Wall,
  offset: number
): { x: number; y: number } {
  const inward = inwardVector(wall);
  return { x: point.x - inward.x * offset, y: point.y - inward.y * offset };
}

function wallRunLength(wall: Round2Wall): number {
  return wall.sourceWall === "TOP" || wall.sourceWall === "BOTTOM"
    ? VIEW.right - VIEW.left - 14
    : VIEW.bottom - VIEW.top - 14;
}

function wallLine(wall: Round2Wall) {
  if (wall.sourceWall === "TOP") {
    return { x1: VIEW.left, y1: VIEW.top, x2: VIEW.right, y2: VIEW.top };
  }
  if (wall.sourceWall === "RIGHT") {
    return { x1: VIEW.right, y1: VIEW.top, x2: VIEW.right, y2: VIEW.bottom };
  }
  if (wall.sourceWall === "BOTTOM") {
    return { x1: VIEW.left, y1: VIEW.bottom, x2: VIEW.right, y2: VIEW.bottom };
  }
  return { x1: VIEW.left, y1: VIEW.top, x2: VIEW.left, y2: VIEW.bottom };
}

function pointOnLine(
  line: { x1: number; y1: number; x2: number; y2: number },
  ratio: number
) {
  return {
    x: line.x1 + (line.x2 - line.x1) * ratio,
    y: line.y1 + (line.y2 - line.y1) * ratio
  };
}

function segmentRect(
  wall: Round2Wall,
  cursor: number,
  length: number,
  depth: number
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (wall.sourceWall === "TOP") {
    return { x: VIEW.left + 7 + cursor, y: VIEW.top + 7, width: length, height: depth };
  }
  if (wall.sourceWall === "RIGHT") {
    return {
      x: VIEW.right - 7 - depth,
      y: VIEW.top + 7 + cursor,
      width: depth,
      height: length
    };
  }
  if (wall.sourceWall === "BOTTOM") {
    return {
      x: VIEW.left + 7 + cursor,
      y: VIEW.bottom - 7 - depth,
      width: length,
      height: depth
    };
  }
  return {
    x: VIEW.left + 7,
    y: VIEW.top + 7 + cursor,
    width: depth,
    height: length
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function planNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}
