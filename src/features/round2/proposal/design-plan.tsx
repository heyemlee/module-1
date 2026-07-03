"use client";

import {
  type Round2Model,
  type Round2Wall,
  type WallId,
  type WallSegment
} from "../model/round2-model";

const VIEW = { left: 155, top: 125, right: 625, bottom: 470 };

function fillForSegment(segment: WallSegment) {
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
  const segments = walls.flatMap((wall) => topViewSegments(wall));

  return (
    <div className="relative h-full min-h-[440px] overflow-hidden rounded-[18px] border border-studio-line bg-white shadow-[0_18px_42px_-30px_rgba(20,20,26,0.28)]">
      <div className="pointer-events-none absolute inset-0 opacity-100 [background-image:linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <p className="absolute left-5 top-4 z-10 font-mono text-[9px] tracking-[0.16em] text-black/45">
        TOP VIEW · CABINET PROPOSAL
      </p>
      <svg
        viewBox="80 60 620 460"
        preserveAspectRatio="xMidYMin meet"
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
            segments={topViewSegments(wall)}
            selectedObjectId={selectedObjectId}
            onSelect={onSelect}
          />
        ))}

        {walls.flatMap((wall) =>
          wall.fixedPoints
            .filter((point) => point.type === "window" || point.type === "door")
            .map((point) => {
              const line = wallLine(wall);
              const center = {
                x: line.x1 + (line.x2 - line.x1) * point.positionRatio,
                y: line.y1 + (line.y2 - line.y1) * point.positionRatio
              };
              return (
                <text
                  key={point.id}
                  x={center.x}
                  y={center.y - 20}
                  textAnchor="middle"
                  fontFamily="var(--studio-mono)"
                  fontSize="10"
                  fill="#079ca5"
                >
                  {point.label.toUpperCase()}
                </text>
              );
            })
        )}
      </svg>

      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5 rounded-[12px] border border-studio-line bg-white/60 p-2 backdrop-blur-md">
        {segments.length === 0 ? (
          <span className="px-2 py-1 font-mono text-[9px] text-black/45">
            SUBMIT MEASUREMENTS TO AUTOFILL
          </span>
        ) : (
          segments.map((segment) => (
            <button
              key={segment.id}
              type="button"
              aria-pressed={selectedObjectId === segment.id}
              onClick={() => onSelect(segment.id, segment.wallId)}
              className="rounded-[7px] border border-studio-line bg-white px-2 py-1 font-mono text-[9px] text-black/60 outline-none transition-colors hover:bg-black/5 hover:text-black focus-visible:ring-2 focus-visible:ring-[#079ca5] aria-pressed:border-[#079ca5] aria-pressed:bg-[#079ca5] aria-pressed:text-white"
            >
              {segment.code ?? segment.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function SegmentRun({
  wall,
  segments,
  selectedObjectId,
  onSelect
}: {
  wall: Round2Wall;
  segments: WallSegment[];
  selectedObjectId: string | null;
  onSelect: (id: string, wall: WallId) => void;
}) {
  const total =
    wall.lengthSixteenths ??
    (segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0) || 1);
  const available =
    wall.sourceWall === "TOP" || wall.sourceWall === "BOTTOM"
      ? VIEW.right - VIEW.left - 14
      : VIEW.bottom - VIEW.top - 14;
  let cursor = 0;

  return (
    <g>
      {segments.map((segment) => {
        const safeWidth = Math.max(0, segment.widthSixteenths);
        const length = (safeWidth / total) * available;
        const rect = segmentRect(wall, cursor, length);
        cursor += length;
        const selected = segment.id === selectedObjectId;
        return (
          <g
            key={segment.id}
            data-segment-id={segment.id}
            data-cabinet-id={segment.id}
            data-selected={selected}
            onClick={() => onSelect(segment.id, wall.id)}
            className="cursor-pointer"
          >
            <rect
              x={rect.x}
              y={rect.y}
              width={Math.max(8, rect.width - 2)}
              height={Math.max(8, rect.height - 2)}
              rx="2"
              fill={fillForSegment(segment)}
              stroke={selected ? "#079ca5" : "#7d8580"}
              strokeWidth={selected ? 3 : 1.25}
            />
            <text
              x={rect.x + rect.width / 2}
              y={rect.y + rect.height / 2 + 3}
              textAnchor="middle"
              fontFamily="var(--studio-mono)"
              fontSize="9"
              fill="#252a27"
              transform={rect.rotate}
            >
              {segment.code ?? segment.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function topViewSegments(wall: Round2Wall): WallSegment[] {
  const base = wall.segments.filter(
    (segment) => segment.tier === "base" || segment.tier === "full"
  );
  return base.length > 0
    ? base
    : wall.segments.filter((segment) => segment.tier === "upper");
}

function wallLine(wall: Round2Wall) {
  if (wall.sourceWall === "TOP") {
    return { x1: VIEW.left, y1: VIEW.top, x2: VIEW.right, y2: VIEW.top };
  }
  if (wall.sourceWall === "RIGHT") {
    return { x1: VIEW.right, y1: VIEW.top, x2: VIEW.right, y2: VIEW.bottom };
  }
  if (wall.sourceWall === "BOTTOM") {
    return { x1: VIEW.right, y1: VIEW.bottom, x2: VIEW.left, y2: VIEW.bottom };
  }
  return { x1: VIEW.left, y1: VIEW.bottom, x2: VIEW.left, y2: VIEW.top };
}

function segmentRect(
  wall: Round2Wall,
  cursor: number,
  length: number
): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: string;
} {
  if (wall.sourceWall === "TOP") {
    return { x: VIEW.left + 7 + cursor, y: VIEW.top + 7, width: length, height: 58 };
  }
  if (wall.sourceWall === "RIGHT") {
    return {
      x: VIEW.right - 61,
      y: VIEW.top + 7 + cursor,
      width: 54,
      height: length,
      rotate: `rotate(90 ${VIEW.right - 34} ${VIEW.top + 7 + cursor + length / 2})`
    };
  }
  if (wall.sourceWall === "BOTTOM") {
    return {
      x: VIEW.right - 7 - cursor - length,
      y: VIEW.bottom - 61,
      width: length,
      height: 54
    };
  }
  return {
    x: VIEW.left + 7,
    y: VIEW.bottom - 7 - cursor - length,
    width: 54,
    height: length,
    rotate: `rotate(-90 ${VIEW.left + 34} ${VIEW.bottom - 7 - cursor - length / 2})`
  };
}
