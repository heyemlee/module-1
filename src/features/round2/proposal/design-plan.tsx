"use client";

import type { Round2Cabinet, WallId } from "../round2-types";

const VIEW = { left: 155, top: 125, right: 625, leftBottom: 405, rightBottom: 470 };

function fillForKind(kind: Round2Cabinet["kind"]) {
  if (kind === "sink") return "#c9ddd5";
  if (kind === "appliance") return "#c4d6dc";
  if (kind === "filler") return "#d9cda9";
  if (kind === "tall") return "#d8d0e2";
  return "#d9ddd8";
}

function cabinetsForWall(cabinets: readonly Round2Cabinet[], wall: WallId) {
  return cabinets.filter((cabinet) => cabinet.wall === wall);
}

export function DesignPlan({
  cabinets,
  selectedObjectId,
  cabinetOffsets,
  onSelect
}: {
  cabinets: readonly Round2Cabinet[];
  selectedObjectId: string | null;
  cabinetOffsets: Record<string, { x: number; y: number }>;
  onSelect: (id: string, wall: WallId) => void;
}) {
  const wallA = cabinetsForWall(cabinets, "A");
  const wallB = cabinetsForWall(cabinets, "B");
  const wallC = cabinetsForWall(cabinets, "C");

  return (
    <div className="relative h-full min-h-[440px] overflow-hidden rounded-[18px] border border-white/10 bg-[#17191a]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <p className="absolute left-5 top-4 z-10 font-mono text-[9px] tracking-[0.16em] text-white/45">
        TOP VIEW · CABINET PROPOSAL
      </p>
      <svg
        viewBox="0 0 780 570"
        role="img"
        aria-label="Cabinet proposal top view"
        className="relative h-full w-full"
      >
        <path d={`M ${VIEW.left} ${VIEW.top} H ${VIEW.right} V ${VIEW.rightBottom}`} stroke="#f1f1ec" strokeWidth="12" fill="none" />
        <path d={`M ${VIEW.left} ${VIEW.top} V ${VIEW.leftBottom}`} stroke="#f1f1ec" strokeWidth="12" fill="none" />
        <CabinetRun
          cabinets={wallA}
          wall="A"
          startX={VIEW.left + 7}
          startY={VIEW.top + 7}
          available={VIEW.right - VIEW.left - 14}
          horizontal
          selectedObjectId={selectedObjectId}
          cabinetOffsets={cabinetOffsets}
          onSelect={onSelect}
        />
        <CabinetRun
          cabinets={wallB}
          wall="B"
          startX={VIEW.left + 7}
          startY={VIEW.top + 7}
          available={VIEW.leftBottom - VIEW.top - 14}
          horizontal={false}
          selectedObjectId={selectedObjectId}
          cabinetOffsets={cabinetOffsets}
          onSelect={onSelect}
        />
        <CabinetRun
          cabinets={wallC}
          wall="C"
          startX={VIEW.right - 61}
          startY={VIEW.top + 7}
          available={VIEW.rightBottom - VIEW.top - 14}
          horizontal={false}
          selectedObjectId={selectedObjectId}
          cabinetOffsets={cabinetOffsets}
          onSelect={onSelect}
        />

        <line x1="315" y1="125" x2="430" y2="125" stroke="#62b7d2" strokeWidth="14" />
        <text x="372" y="104" textAnchor="middle" fontFamily="var(--studio-mono)" fontSize="10" fill="#84bdd6">
          WINDOW 36″
        </text>
      </svg>

      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5 rounded-[12px] border border-white/10 bg-black/25 p-2 backdrop-blur-md">
        {cabinets.map((cabinet) => (
          <button
            key={cabinet.id}
            type="button"
            aria-pressed={selectedObjectId === cabinet.id}
            onClick={() => onSelect(cabinet.id, cabinet.wall)}
            className="rounded-[7px] border border-white/10 bg-white/[0.06] px-2 py-1 font-mono text-[9px] text-white/60 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#65d7dc] aria-pressed:border-[#65d7dc] aria-pressed:bg-[#65d7dc] aria-pressed:text-[#101415]"
          >
            {cabinet.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CabinetRun({
  cabinets,
  wall,
  startX,
  startY,
  available,
  horizontal,
  selectedObjectId,
  cabinetOffsets,
  onSelect
}: {
  cabinets: readonly Round2Cabinet[];
  wall: WallId;
  startX: number;
  startY: number;
  available: number;
  horizontal: boolean;
  selectedObjectId: string | null;
  cabinetOffsets: Record<string, { x: number; y: number }>;
  onSelect: (id: string, wall: WallId) => void;
}) {
  const total = cabinets.reduce((sum, cabinet) => sum + cabinet.width, 0) || 1;
  let cursor = 0;

  return cabinets.map((cabinet) => {
    const length = (cabinet.width / total) * available;
    const x = horizontal ? startX + cursor : startX;
    const y = horizontal ? startY : startY + cursor;
    const width = horizontal ? length : 54;
    const height = horizontal ? 58 : length;
    cursor += length;
    const selected = cabinet.id === selectedObjectId;
    const offset = cabinetOffsets[cabinet.id] ?? { x: 0, y: 0 };
    const offsetX = offset.x * 2;
    const offsetY = offset.y * 2;
    const adjustedX = x + offsetX;
    const adjustedY = y - offsetY;

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
          width={Math.max(10, width - 2)}
          height={Math.max(10, height - 2)}
          rx="2"
          fill={fillForKind(cabinet.kind)}
          stroke={selected ? "#65d7dc" : "#7d8580"}
          strokeWidth={selected ? 3 : 1.25}
        />
        <text
          x={adjustedX + width / 2}
          y={adjustedY + height / 2 + 3}
          textAnchor="middle"
          fontFamily="var(--studio-mono)"
          fontSize="9"
          fill="#252a27"
          transform={horizontal ? undefined : `rotate(90 ${adjustedX + width / 2} ${adjustedY + height / 2})`}
        >
          {cabinet.label}
        </text>
      </g>
    );
  });
}
