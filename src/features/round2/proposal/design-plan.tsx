"use client";

import {
  formatSixteenths,
  type Round2Model,
  type Round2Wall,
  type WallId,
  type WallSegment
} from "../model/round2-model";
import { CABINET_STANDARDS } from "../model/cabinet-standards";

// Read-only top-view projection. The elevation owns every edit; this plan
// only mirrors the model (base depth solid, upper depth dashed, tall full
// depth) and navigates the selection on click.

const VIEW = { left: 155, top: 125, right: 625, bottom: 470 };

// Strip depth in px for a 24″ base cabinet; uppers scale from the standards.
const BASE_DEPTH_PX = 52;
const PX_PER_SIXTEENTH =
  BASE_DEPTH_PX / CABINET_STANDARDS.depths.baseSixteenths;

function fillForSegment(segment: WallSegment) {
  if (isCornerGap(segment)) return "#f3ead5";
  if (segment.cabinetKind === "corner") return "#e5d9b8";
  if (segment.cabinetKind === "sink") return "#c9ddd5";
  if (segment.cabinetKind === "tall") return "#d8d0e2";
  if (segment.kind === "appliance") return "#c4d6dc";
  if (segment.kind === "filler") return "#d9c061";
  if (segment.kind === "opening") return "#7dbbd6";
  return "#d9ddd8";
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
      <p className="absolute left-4 top-3 z-10 font-mono text-[8px] tracking-[0.16em] text-black/45">
        TOP VIEW · READ-ONLY PROJECTION
      </p>
      <svg
        viewBox="60 50 660 480"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Cabinet proposal top view"
        className="relative h-full w-full"
      >
        {walls.map((wall) => {
          const line = wallLine(wall);
          return (
            <path
              key={wall.id}
              d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
              stroke="#151515"
              strokeWidth="12"
              strokeLinecap="square"
              fill="none"
            />
          );
        })}

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

        {walls.flatMap((wall) => openingMarks(wall))}

        {walls.map((wall) => (
          <WallTotalDimension key={wall.id} wall={wall} />
        ))}

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
      </svg>
    </div>
  );
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
        const displayLabel = planDisplayLabel(segment);
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
              width={Math.max(6, rect.width - 2)}
              height={Math.max(6, rect.height - 2)}
              rx="2"
              fill={fillForSegment(segment)}
              stroke={selected ? "#079ca5" : cornerGap ? "#a98e54" : "#7d8580"}
              strokeWidth={selected ? 3 : 1.25}
              strokeDasharray={cornerGap ? "5 3" : undefined}
            />
            <text
              data-display-label={displayLabel}
              x={rect.x + rect.width / 2}
              y={rect.y + rect.height / 2 + 3}
              textAnchor="middle"
              fontFamily="var(--studio-mono)"
              fontSize="9"
              fill="#252a27"
              transform={rect.rotate}
            >
              {displayLabel}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Upper run projected as a dashed half-depth outline over the base strip. */
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
        if (segment.kind !== "cabinet") return null;
        return (
          <rect
            key={segment.id}
            x={rect.x}
            y={rect.y}
            width={Math.max(4, rect.width - 2)}
            height={Math.max(4, rect.height - 2)}
            fill="none"
            stroke="#5c6f78"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        );
      })}
    </g>
  );
}

function openingMarks(wall: Round2Wall) {
  return wall.fixedPoints
    .filter((point) => point.type === "window" || point.type === "door")
    .map((point) => {
      const line = wallLine(wall);
      const length = wall.lengthSixteenths;
      const startRatio =
        length && point.offsetSixteenths != null
          ? point.offsetSixteenths / length
          : point.positionRatio;
      const widthRatio =
        length && point.widthSixteenths ? point.widthSixteenths / length : 0.12;
      const start = pointOnLine(line, clamp01(startRatio));
      const end = pointOnLine(line, clamp01(startRatio + widthRatio));
      return (
        <g key={point.id} data-plan-layer="openings">
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#7dbbd6"
            strokeWidth="6"
          />
          <text
            x={(start.x + end.x) / 2 + labelOffset(wall).x}
            y={(start.y + end.y) / 2 + labelOffset(wall).y}
            textAnchor="middle"
            fontFamily="var(--studio-mono)"
            fontSize="9"
            fill="#079ca5"
          >
            {point.label.toUpperCase()}
          </text>
        </g>
      );
    });
}

function WallTotalDimension({ wall }: { wall: Round2Wall }) {
  const line = wallLine(wall);
  const offset = labelOffset(wall);
  const midX = (line.x1 + line.x2) / 2 + offset.x * 2.2;
  const midY = (line.y1 + line.y2) / 2 + offset.y * 2.2;
  const vertical = wall.sourceWall === "LEFT" || wall.sourceWall === "RIGHT";
  return (
    <text
      x={midX}
      y={midY}
      textAnchor="middle"
      fontFamily="var(--studio-mono)"
      fontSize="10"
      fill="#079ca5"
      transform={vertical ? `rotate(${wall.sourceWall === "RIGHT" ? 90 : -90} ${midX} ${midY})` : undefined}
    >
      {wall.label} · {formatSixteenths(wall.lengthSixteenths)}
    </text>
  );
}

function depthPx(segment: WallSegment): number {
  const depths = CABINET_STANDARDS.depths;
  const sixteenths =
    segment.tier === "upper"
      ? segment.label.startsWith("WR")
        ? depths.refrigeratorUpperSixteenths
        : depths.upperSixteenths
      : segment.cabinetKind === "tall"
        ? depths.tallSixteenths
        : depths.baseSixteenths;
  return sixteenths * PX_PER_SIXTEENTH;
}

function shouldRenderPlanSegment(segment: WallSegment): boolean {
  if (segment.kind === "opening") return false;
  if (segment.kind === "gap") return isCornerGap(segment);
  return true;
}

function isCornerGap(segment: WallSegment): boolean {
  return segment.kind === "gap" && Boolean(segment.sourceCornerId);
}

function planDisplayLabel(segment: WallSegment): string {
  const label = segment.code ?? segment.label;
  const normalized = label.trim().toLowerCase();
  if (normalized === "blind corner") return "BLIND";
  if (normalized === "corner clearance") return "CLR";
  if (normalized.endsWith(" return")) {
    return label.replace(/\s+return$/i, "");
  }
  return label;
}

function labelOffset(wall: Round2Wall): { x: number; y: number } {
  if (wall.sourceWall === "TOP") return { x: 0, y: -18 };
  if (wall.sourceWall === "BOTTOM") return { x: 0, y: 24 };
  if (wall.sourceWall === "LEFT") return { x: -20, y: 0 };
  return { x: 20, y: 0 };
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
  rotate?: string;
} {
  if (wall.sourceWall === "TOP") {
    return { x: VIEW.left + 7 + cursor, y: VIEW.top + 7, width: length, height: depth };
  }
  if (wall.sourceWall === "RIGHT") {
    return {
      x: VIEW.right - 7 - depth,
      y: VIEW.top + 7 + cursor,
      width: depth,
      height: length,
      rotate: `rotate(90 ${VIEW.right - 7 - depth / 2} ${VIEW.top + 7 + cursor + length / 2})`
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
    height: length,
    rotate: `rotate(-90 ${VIEW.left + 7 + depth / 2} ${VIEW.top + 7 + cursor + length / 2})`
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
