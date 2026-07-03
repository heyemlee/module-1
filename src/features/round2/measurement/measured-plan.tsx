"use client";

import { cn } from "@/lib/utils";
import {
  formatSixteenths,
  openingWidthMeasurementKey,
  wallLengthMeasurementKey,
  type MeasurementKey,
  type Round2FixedPoint,
  type Round2Model,
  type Round2Wall,
  type WallId
} from "../model/round2-model";
import type { Round2Measurements } from "../round2-types";

const VIEW = {
  left: 170,
  top: 145,
  right: 590,
  bottom: 430
};

// Pure-white measured plan: black structural lines, blue dimension annotations.
const INK = "#151515";
const BLUE = "#1478ff";
const ACTIVE = "#b26a00";
const WALL_STROKE = 4;

type Line = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function MeasuredPlan({
  model,
  measurements,
  selectedWall,
  selectedObjectId,
  activeMeasurementKey,
  onSelectWall,
  onSelectMeasurement
}: {
  model: Round2Model | null;
  measurements: Round2Measurements;
  selectedWall: WallId | null;
  selectedObjectId: string | null;
  activeMeasurementKey: MeasurementKey | null;
  onSelectWall: (wall: WallId) => void;
  onSelectMeasurement: (field: MeasurementKey) => void;
}) {
  const walls = model?.walls ?? [];
  const wallStroke = (wall: Round2Wall) => INK;

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-[18px] border border-studio-line bg-white shadow-[0_18px_42px_-30px_rgba(20,20,26,0.28)]">
      <div className="pointer-events-none absolute inset-0 opacity-100 [background-image:linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute left-5 top-4 z-10 flex items-center gap-2 font-mono text-[9px] tracking-[0.16em] text-black/45">
        <span>LIVE MEASURED PLAN</span>
        <span className="size-1 rounded-full bg-[#1478ff]" />
        <span>FIELD INPUT</span>
      </div>

      <svg
        viewBox="0 0 760 560"
        role="img"
        aria-label="Measured kitchen plan"
        className="relative h-full w-full"
      >
        {walls.length === 0 ? (
          <text
            x="380"
            y="280"
            textAnchor="middle"
            fontFamily="var(--studio-mono)"
            fontSize="13"
            fill="rgba(20,20,26,.55)"
          >
            LOCK ROUND 1 REFERENCE
          </text>
        ) : (
          <>
            <g>
              {walls.map((wall) => {
                const line = wallLine(wall);
                const measured = wall.lengthSixteenths != null;
                return (
                  <path
                    key={wall.id}
                    data-wall={wall.id}
                    data-source-wall={wall.sourceWall}
                    data-selected={selectedWall === wall.id}
                    d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
                    stroke={wallStroke(wall)}
                    strokeWidth={WALL_STROKE}
                    strokeLinecap="square"
                    fill="none"
                    onClick={() => onSelectWall(wall.id)}
                    className="cursor-pointer"
                  />
                );
              })}
            </g>

            <g stroke={BLUE} fill={BLUE} fontFamily="var(--studio-mono)">
              {walls.map((wall) => (
                <WallDimension
                  key={wall.id}
                  wall={wall}
                  activeMeasurementKey={activeMeasurementKey}
                  onSelectMeasurement={onSelectMeasurement}
                />
              ))}
            </g>

            <g>
              {walls.flatMap((wall) =>
                wall.fixedPoints
                  .filter((point) => point.type === "window" || point.type === "door")
                  .map((point) => (
                    <OpeningMark
                      key={point.id}
                      wall={wall}
                      point={point}
                      measurements={measurements}
                      onSelectMeasurement={onSelectMeasurement}
                    />
                  ))
              )}
            </g>


          </>
        )}
      </svg>

      <div className="absolute inset-0">
        {walls.map((wall) => (
          <button
            key={wall.id}
            type="button"
            aria-label={`Select Wall ${wall.label}`}
            aria-pressed={selectedWall === wall.id}
            onClick={() => onSelectWall(wall.id)}
            className={cn(
              "absolute z-10 grid place-items-center p-2 font-mono text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#1478ff]",
              wallButtonPosition(wall),
              selectedWall === wall.id
                ? "text-black"
                : "text-black/60 hover:text-black"
            )}
          >
            {wall.label}
          </button>
        ))}
      </div>

      <span className="sr-only" aria-live="polite">
        {selectedObjectId
          ? `${selectedObjectId} selected on Wall ${selectedWall ?? ""}`
          : selectedWall
            ? `Wall ${selectedWall} selected`
            : "No wall selected"}
      </span>
    </div>
  );
}

function WallDimension({
  wall,
  activeMeasurementKey,
  onSelectMeasurement
}: {
  wall: Round2Wall;
  activeMeasurementKey: MeasurementKey | null;
  onSelectMeasurement: (field: MeasurementKey) => void;
}) {
  const key = wallLengthMeasurementKey(wall.id);
  const active = key === activeMeasurementKey;
  const label = formatSixteenths(wall.lengthSixteenths);
  const color = label === "待量" ? BLUE : (active ? ACTIVE : BLUE);

  if (wall.sourceWall === "TOP") {
    return (
      <g
        data-measurement-key={key}
        onClick={() => onSelectMeasurement(key)}
        className="cursor-pointer"
        stroke={color}
        fill={color}
      >
        <path d={`M ${VIEW.left} 98 V 113 M ${VIEW.right} 98 V 113 M ${VIEW.left} 105 H ${VIEW.right}`} strokeWidth="1" />
        <text x={(VIEW.left + VIEW.right) / 2} y="94" textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="var(--studio-mono)" stroke="none">
          {label}
        </text>
      </g>
    );
  }

  if (wall.sourceWall === "RIGHT") {
    return (
      <g
        data-measurement-key={key}
        onClick={() => onSelectMeasurement(key)}
        className="cursor-pointer"
        stroke={color}
        fill={color}
      >
        <path d={`M 620 ${VIEW.top} H 635 M 620 ${VIEW.bottom} H 635 M 628 ${VIEW.top} V ${VIEW.bottom}`} strokeWidth="1" />
        <text x="648" y={(VIEW.top + VIEW.bottom) / 2} textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="var(--studio-mono)" stroke="none" transform={`rotate(90 648 ${(VIEW.top + VIEW.bottom) / 2})`}>
          {label}
        </text>
      </g>
    );
  }

  if (wall.sourceWall === "BOTTOM") {
    return (
      <g
        data-measurement-key={key}
        onClick={() => onSelectMeasurement(key)}
        className="cursor-pointer"
        stroke={color}
        fill={color}
      >
        <path d={`M ${VIEW.left} 462 V 477 M ${VIEW.right} 462 V 477 M ${VIEW.left} 470 H ${VIEW.right}`} strokeWidth="1" />
        <text x={(VIEW.left + VIEW.right) / 2} y="496" textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="var(--studio-mono)" stroke="none">
          {label}
        </text>
      </g>
    );
  }

  return (
    <g
      data-measurement-key={key}
      onClick={() => onSelectMeasurement(key)}
      className="cursor-pointer"
      stroke={color}
      fill={color}
    >
      <path d={`M 126 ${VIEW.top} H 140 M 126 ${VIEW.bottom} H 140 M 133 ${VIEW.top} V ${VIEW.bottom}`} strokeWidth="1" />
      <text x="116" y={(VIEW.top + VIEW.bottom) / 2} textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="var(--studio-mono)" stroke="none" transform={`rotate(-90 116 ${(VIEW.top + VIEW.bottom) / 2})`}>
        {label}
      </text>
    </g>
  );
}

function OpeningMark({
  wall,
  point,
  measurements,
  onSelectMeasurement
}: {
  wall: Round2Wall;
  point: Round2FixedPoint;
  measurements: Round2Measurements;
  onSelectMeasurement: (field: MeasurementKey) => void;
}) {
  const key = openingWidthMeasurementKey(point.id);
  const width = measurements[key] ?? point.widthSixteenths ?? null;
  const line = wallLine(wall);
  const lineLength = linePixelLength(line);
  const wallLength = wall.lengthSixteenths;
  const widthPx =
    wallLength && width
      ? Math.max(20, (width / wallLength) * lineLength)
      : 76;
  const startRatio =
    wallLength && point.offsetSixteenths != null
      ? point.offsetSixteenths / wallLength
      : point.positionRatio;
  const start = pointOnLine(line, Math.min(1, Math.max(0, startRatio)));
  const end = pointOnLine(
    line,
    Math.min(1, Math.max(0, startRatio + widthPx / lineLength))
  );
  const label = `${point.label.toUpperCase()} ${formatSixteenths(width)}`;
  const horizontal = wall.sourceWall === "TOP" || wall.sourceWall === "BOTTOM";

  return (
    <g
      data-fixed-point-id={point.id}
      data-measurement-key={key}
      onClick={() => onSelectMeasurement(key)}
      className="cursor-pointer"
    >
      {/* The opening is embedded in the wall line: clear the wall band, then
          draw the glazing so it reads as set into the wall, not floating. */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#ffffff"
        strokeWidth={WALL_STROKE}
      />
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={BLUE}
        strokeWidth={WALL_STROKE}
        strokeOpacity={0.22}
      />
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={BLUE}
        strokeWidth={2.4}
      />
      <text
        x={(start.x + end.x) / 2}
        y={
          horizontal
            ? start.y - 14
            : (start.y + end.y) / 2
        }
        dx={horizontal ? 0 : 16}
        textAnchor="middle"
        fill={BLUE}
        fontFamily="var(--studio-mono)"
        fontSize="11"
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  );
}

function wallLine(wall: Round2Wall): Line {
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

function linePixelLength(line: Line): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function pointOnLine(line: Line, ratio: number): { x: number; y: number } {
  return {
    x: line.x1 + (line.x2 - line.x1) * ratio,
    y: line.y1 + (line.y2 - line.y1) * ratio
  };
}


function wallButtonPosition(wall: Round2Wall): string {
  if (wall.sourceWall === "TOP") return "left-1/2 top-3 -translate-x-1/2";
  if (wall.sourceWall === "RIGHT") return "right-3 top-1/2 -translate-y-1/2";
  if (wall.sourceWall === "BOTTOM") return "bottom-3 left-1/2 -translate-x-1/2";
  return "left-3 top-1/2 -translate-y-1/2";
}
