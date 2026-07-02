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
  const wallStroke = (wall: Round2Wall) =>
    selectedWall === wall.id ? "#65d7dc" : "#f0f0eb";

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-[18px] border border-white/10 bg-[#17191a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute left-5 top-4 z-10 flex items-center gap-2 font-mono text-[9px] tracking-[0.16em] text-white/45">
        <span>LIVE MEASURED PLAN</span>
        <span className="size-1 rounded-full bg-[#65d7dc]" />
        <span>FIELD INPUT</span>
      </div>

      <svg
        viewBox="0 0 760 560"
        role="img"
        aria-label="Measured kitchen plan"
        className="relative h-full w-full"
      >
        <defs>
          <filter id="round2-plan-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity=".24" />
          </filter>
        </defs>

        {walls.length === 0 ? (
          <text
            x="380"
            y="280"
            textAnchor="middle"
            fontFamily="var(--studio-mono)"
            fontSize="13"
            fill="rgba(255,255,255,.55)"
          >
            LOCK ROUND 1 REFERENCE
          </text>
        ) : (
          <>
            <g filter="url(#round2-plan-shadow)">
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
                    strokeWidth="12"
                    strokeLinecap="square"
                    strokeDasharray={measured ? undefined : "16 10"}
                    fill="none"
                    onClick={() => onSelectWall(wall.id)}
                    className="cursor-pointer"
                  />
                );
              })}
            </g>

            <g stroke="#65d7dc" fill="#65d7dc" fontFamily="var(--studio-mono)">
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

            <g>
              {walls.flatMap((wall) =>
                wall.fixedPoints
                  .filter((point) => point.type === "appliance")
                  .map((point) => (
                    <FixedPointMark key={point.id} wall={wall} point={point} />
                  ))
              )}
            </g>

            <g fontFamily="var(--studio-mono)" fontSize="11">
              {walls.map((wall) => {
                const label = wallLabelPosition(wall);
                return (
                  <text
                    key={wall.id}
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    fill={wallStroke(wall)}
                    transform={label.rotate}
                  >
                    Wall {wall.label}
                  </text>
                );
              })}
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
              "absolute z-10 grid size-9 place-items-center rounded-full border font-mono text-[9px] outline-none backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:ring-[#65d7dc]",
              wallButtonPosition(wall),
              selectedWall === wall.id
                ? "border-[#65d7dc] bg-[#65d7dc] text-[#101415]"
                : "border-white/15 bg-black/35 text-white/65 hover:border-white/30 hover:text-white"
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
  const color = active ? "#f0c36a" : "#65d7dc";

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
        <text x={(VIEW.left + VIEW.right) / 2} y="94" textAnchor="middle" fontSize="12">
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
        <text x="648" y={(VIEW.top + VIEW.bottom) / 2} textAnchor="middle" fontSize="12" transform={`rotate(90 648 ${(VIEW.top + VIEW.bottom) / 2})`}>
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
        <text x={(VIEW.left + VIEW.right) / 2} y="496" textAnchor="middle" fontSize="12">
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
      <text x="116" y={(VIEW.top + VIEW.bottom) / 2} textAnchor="middle" fontSize="12" transform={`rotate(-90 116 ${(VIEW.top + VIEW.bottom) / 2})`}>
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

  return (
    <g
      data-fixed-point-id={point.id}
      data-measurement-key={key}
      onClick={() => onSelectMeasurement(key)}
      className="cursor-pointer"
      stroke="#4b8fae"
      fill="#84bdd6"
    >
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        strokeWidth="14"
      />
      <text
        x={(start.x + end.x) / 2}
        y={(start.y + end.y) / 2 - 18}
        textAnchor="middle"
        fontFamily="var(--studio-mono)"
        fontSize="10"
      >
        {label}
      </text>
    </g>
  );
}

function FixedPointMark({
  wall,
  point
}: {
  wall: Round2Wall;
  point: Round2FixedPoint;
}) {
  const line = wallLine(wall);
  const pointOnWall = pointOnLine(line, point.positionRatio);
  return (
    <g fontFamily="var(--studio-mono)" fontSize="9" textAnchor="middle">
      <circle
        cx={pointOnWall.x}
        cy={pointOnWall.y}
        r="15"
        fill="#d4d7d1"
        stroke="#8d9691"
        strokeWidth="1.5"
      />
      <text x={pointOnWall.x} y={pointOnWall.y + 3} fill="#303633">
        {point.symbol?.slice(0, 2).toUpperCase() ?? point.label.slice(0, 2)}
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

function wallLabelPosition(wall: Round2Wall): {
  x: number;
  y: number;
  rotate?: string;
} {
  if (wall.sourceWall === "TOP") return { x: 380, y: 84 };
  if (wall.sourceWall === "RIGHT") {
    return { x: 670, y: 288, rotate: "rotate(90 670 288)" };
  }
  if (wall.sourceWall === "BOTTOM") return { x: 380, y: 520 };
  return { x: 96, y: 288, rotate: "rotate(-90 96 288)" };
}

function wallButtonPosition(wall: Round2Wall): string {
  if (wall.sourceWall === "TOP") return "left-1/2 top-3 -translate-x-1/2";
  if (wall.sourceWall === "RIGHT") return "right-3 top-1/2 -translate-y-1/2";
  if (wall.sourceWall === "BOTTOM") return "bottom-3 left-1/2 -translate-x-1/2";
  return "left-3 top-1/2 -translate-y-1/2";
}
