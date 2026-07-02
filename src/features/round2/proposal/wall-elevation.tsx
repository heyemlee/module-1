"use client";

import type { Round2Cabinet, WallId } from "../round2-types";

function cabinetHeight(kind: Round2Cabinet["kind"]) {
  if (kind === "upper") return { y: 92, height: 88 };
  if (kind === "tall" || kind === "appliance") return { y: 92, height: 214 };
  return { y: 214, height: 92 };
}

function cabinetFill(kind: Round2Cabinet["kind"]) {
  if (kind === "sink") return "#eef7f4";
  if (kind === "appliance") return "#edf5f7";
  if (kind === "filler") return "#f7f2e7";
  return "#fbfbf8";
}

export function WallElevation({
  wall,
  cabinets,
  selectedObjectId,
  cabinetOffsets,
  onSelect
}: {
  wall: WallId;
  cabinets: readonly Round2Cabinet[];
  selectedObjectId: string | null;
  cabinetOffsets: Record<string, { x: number; y: number }>;
  onSelect: (id: string, wall: WallId) => void;
}) {
  const wallCabinets = cabinets.filter((cabinet) => cabinet.wall === wall);
  const total = wallCabinets.reduce((sum, cabinet) => sum + cabinet.width, 0) || 1;
  const usable = 500;
  let cursor = 0;

  return (
    <div className="h-full min-h-[440px] overflow-hidden rounded-[18px] border border-studio-paper-line bg-[#fbfbf8] shadow-[0_18px_42px_-30px_rgba(20,20,26,0.32)]">
      <div className="flex items-center justify-between border-b border-studio-paper-line px-4 py-3">
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-studio-quiet">
            SELECTED ELEVATION
          </p>
          <h3 className="mt-1 text-[15px] font-semibold">Wall {wall}</h3>
        </div>
        <span className="font-mono text-[9px] text-studio-quiet">1:30</span>
      </div>

      <svg
        viewBox="0 0 640 380"
        role="img"
        aria-label={`Wall ${wall} cabinet elevation`}
        className="h-[calc(100%-68px)] min-h-[360px] w-full"
      >
        <g data-elevation-layer="dimensions" stroke="#079ca5" fill="#079ca5" fontFamily="var(--studio-mono)">
          <path d="M 70 42 V 54 M 570 42 V 54 M 70 48 H 570" strokeWidth="1" />
          <text x="320" y="37" textAnchor="middle" fontSize="11">150 3/8″</text>
          <path d="M 586 92 H 598 M 586 306 H 598 M 592 92 V 306" strokeWidth="1" />
          <text x="611" y="199" textAnchor="middle" fontSize="10" transform="rotate(90 611 199)">95 13/16″</text>
          <path d="M 58 214 H 66 M 58 306 H 66 M 62 214 V 306" strokeWidth="1" />
          <text x="49" y="260" textAnchor="middle" fontSize="10" transform="rotate(-90 49 260)">36″</text>
        </g>

        <line x1="70" y1="306" x2="570" y2="306" stroke="#292929" strokeWidth="2" />
        {wallCabinets.map((cabinet) => {
          const width = (cabinet.width / total) * usable;
          const x = 70 + cursor;
          cursor += width;
          const { y, height } = cabinetHeight(cabinet.kind);
          const selected = selectedObjectId === cabinet.id;
          const offset = cabinetOffsets[cabinet.id] ?? { x: 0, y: 0 };
          const adjustedX = x + offset.x * 2;
          const adjustedY = y - offset.y * 2;
          return (
            <g
              key={cabinet.id}
              data-cabinet-id={cabinet.id}
              data-selected={selected}
              data-offset-x={offset.x}
              data-offset-y={offset.y}
              onClick={() => onSelect(cabinet.id, wall)}
              className="cursor-pointer"
            >
              <rect
                x={adjustedX}
                y={adjustedY}
                width={Math.max(8, width)}
                height={height}
                fill={cabinetFill(cabinet.kind)}
                stroke={selected ? "#079ca5" : "#2c2c2c"}
                strokeWidth={selected ? 3 : 1.5}
              />
              <path
                d={`M ${adjustedX + 4} ${adjustedY + 4} L ${adjustedX + width / 2} ${adjustedY + height / 2} L ${adjustedX + width - 4} ${adjustedY + 4}`}
                stroke={cabinet.kind === "upper" ? "#e12821" : "#a7aaa5"}
                strokeWidth="1"
                fill="none"
              />
              <text
                x={adjustedX + width / 2}
                y={adjustedY + height / 2 + 5}
                textAnchor="middle"
                fontFamily="var(--studio-mono)"
                fontSize="13"
                fill="#e12821"
              >
                {cabinet.code}
              </text>
              <text
                x={adjustedX + width / 2}
                y="329"
                textAnchor="middle"
                fontFamily="var(--studio-mono)"
                fontSize="9"
                fill="#079ca5"
              >
                {cabinet.width / 16}″
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
