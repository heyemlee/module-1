"use client";

import { cn } from "@/lib/utils";
import {
  findWall,
  formatSixteenths,
  type Round2Model,
  type WallId,
  type WallSegment
} from "../model/round2-model";

function segmentHeight(segment: WallSegment) {
  if (segment.tier === "upper") return { y: 92, height: 88 };
  if (segment.tier === "full") return { y: 92, height: 214 };
  return { y: 214, height: 92 };
}

function segmentFill(segment: WallSegment) {
  if (segment.cabinetKind === "sink") return "#eef7f4";
  if (segment.cabinetKind === "tall") return "#f1ecf7";
  if (segment.kind === "opening") return "#dceff7";
  if (segment.kind === "appliance") return "#edf5f7";
  if (segment.kind === "filler") return "#f0dda0";
  return "#fbfbf8";
}

export function WallElevation({
  wallId,
  model,
  selectedObjectId,
  onSelect,
  onSelectWall
}: {
  wallId: WallId | null;
  model: Round2Model | null;
  selectedObjectId: string | null;
  onSelect: (id: string, wall: WallId) => void;
  onSelectWall?: (wall: WallId) => void;
}) {
  const wall = findWall(model, wallId);
  const total =
    wall?.lengthSixteenths ??
    wall?.segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0) ??
    1;
  const usable = 500;
  const upper = wall?.segments.filter((segment) => segment.tier === "upper") ?? [];
  const base = wall?.segments.filter((segment) => segment.tier === "base") ?? [];

  return (
    <div className="relative h-full min-h-[440px] overflow-hidden rounded-[18px] border border-studio-line bg-white shadow-[0_18px_42px_-30px_rgba(20,20,26,0.28)]">
      <div className="pointer-events-none absolute inset-0 opacity-100 [background-image:linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative z-10 flex items-center justify-between border-b border-studio-line/40 px-4 py-3">
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-black/45">
            SELECTED ELEVATION
          </p>
          <div className="mt-1.5 flex items-center gap-1 rounded-[8px] border border-studio-line/40 bg-white p-0.5 shadow-sm">
            {(model?.walls ?? []).map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={wallId === w.id}
                onClick={() => onSelectWall?.(w.id)}
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
        <span className="font-mono text-[9px] text-black/45">1:30</span>
      </div>

      <svg
        viewBox="0 0 640 380"
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={wall ? `Wall ${wall.label} cabinet elevation` : "Cabinet elevation"}
        className="h-[calc(100%-68px)] min-h-[360px] w-full"
      >
        <g data-elevation-layer="dimensions" stroke="#079ca5" fill="#079ca5" fontFamily="var(--studio-mono)">
          <path d="M 70 42 V 54 M 570 42 V 54 M 70 48 H 570" strokeWidth="1" />
          <text x="320" y="37" textAnchor="middle" fontSize="11">
            {formatSixteenths(wall?.lengthSixteenths)}
          </text>
          <path d="M 586 92 H 598 M 586 306 H 598 M 592 92 V 306" strokeWidth="1" />
          <text x="611" y="199" textAnchor="middle" fontSize="10" transform="rotate(90 611 199)">
            {formatSixteenths(model?.ceilingHeightSixteenths)}
          </text>
          <path d="M 58 214 H 66 M 58 306 H 66 M 62 214 V 306" strokeWidth="1" />
          <text x="49" y="260" textAnchor="middle" fontSize="10" transform="rotate(-90 49 260)">34 1/2″</text>
        </g>

        <line x1="70" y1="306" x2="570" y2="306" stroke="#292929" strokeWidth="2" />
        {wall ? (
          <>
            <ElevationRun
              wallId={wall.id}
              segments={upper}
              total={total}
              usable={usable}
              selectedObjectId={selectedObjectId}
              onSelect={onSelect}
            />
            <ElevationRun
              wallId={wall.id}
              segments={base}
              total={total}
              usable={usable}
              selectedObjectId={selectedObjectId}
              onSelect={onSelect}
            />
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
    </div>
  );
}

function ElevationRun({
  wallId,
  segments,
  total,
  usable,
  selectedObjectId,
  onSelect
}: {
  wallId: WallId;
  segments: WallSegment[];
  total: number;
  usable: number;
  selectedObjectId: string | null;
  onSelect: (id: string, wall: WallId) => void;
}) {
  let cursor = 0;
  return (
    <g>
      {segments.map((segment) => {
        const safeWidth = Math.max(0, segment.widthSixteenths);
        const width = (safeWidth / total) * usable;
        const x = 70 + cursor;
        cursor += width;
        const { y, height } = segmentHeight(segment);
        const selected = selectedObjectId === segment.id;
        return (
          <g
            key={segment.id}
            data-segment-id={segment.id}
            data-cabinet-id={segment.id}
            data-selected={selected}
            onClick={() => onSelect(segment.id, wallId)}
            className="cursor-pointer"
          >
            <rect
              x={x}
              y={y}
              width={Math.max(8, width)}
              height={height}
              fill={segmentFill(segment)}
              stroke={selected ? "#079ca5" : "#2c2c2c"}
              strokeWidth={selected ? 3 : 1.5}
            />
            {segment.kind !== "filler" && segment.kind !== "opening" && (
              <path
                d={`M ${x + 4} ${y + 4} L ${x + width / 2} ${y + height / 2} L ${x + width - 4} ${y + 4}`}
                stroke={segment.tier === "upper" ? "#e12821" : "#a7aaa5"}
                strokeWidth="1"
                fill="none"
              />
            )}
            <text
              x={x + width / 2}
              y={y + height / 2 + 5}
              textAnchor="middle"
              fontFamily="var(--studio-mono)"
              fontSize="13"
              fill={segment.kind === "filler" ? "#7a5b00" : "#e12821"}
            >
              {segment.code ?? segment.label}
            </text>
            <text
              x={x + width / 2}
              y="329"
              textAnchor="middle"
              fontFamily="var(--studio-mono)"
              fontSize="9"
              fill="#079ca5"
            >
              {formatSixteenths(segment.widthSixteenths)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
