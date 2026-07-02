"use client";

import { cn } from "@/lib/utils";
import type { Round2Measurements, WallId } from "../round2-types";

function formatSixteenths(value: number) {
  const totalInches = Math.floor(value / 16);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}′ ${inches}″`;
}

const WALL_BUTTONS: readonly {
  id: WallId;
  label: string;
  position: string;
}[] = [
  { id: "A", label: "Wall A", position: "left-1/2 top-3 -translate-x-1/2" },
  { id: "B", label: "Wall B", position: "left-3 top-1/2 -translate-y-1/2" },
  { id: "C", label: "Wall C", position: "right-3 top-1/2 -translate-y-1/2" }
];

export function MeasuredPlan({
  measurements,
  selectedWall,
  selectedObjectId,
  onSelectWall
}: {
  measurements: Round2Measurements;
  selectedWall: WallId;
  selectedObjectId: string | null;
  onSelectWall: (wall: WallId) => void;
}) {
  const wallStroke = (wall: WallId) =>
    selectedWall === wall ? "#65d7dc" : "#f0f0eb";

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

        <g filter="url(#round2-plan-shadow)">
          <path
            d="M 170 145 H 590 V 465"
            fill="#f7f7f2"
            fillOpacity=".025"
            stroke="none"
          />
          <path
            data-wall="A"
            data-selected={selectedWall === "A"}
            d="M 170 145 H 590"
            stroke={wallStroke("A")}
            strokeWidth="12"
            strokeLinecap="square"
            fill="none"
          />
          <path
            data-wall="B"
            data-selected={selectedWall === "B"}
            d="M 170 145 V 390"
            stroke={wallStroke("B")}
            strokeWidth="12"
            strokeLinecap="square"
            fill="none"
          />
          <path
            data-wall="C"
            data-selected={selectedWall === "C"}
            d="M 590 145 V 465"
            stroke={wallStroke("C")}
            strokeWidth="12"
            strokeLinecap="square"
            fill="none"
          />
        </g>

        <g stroke="#65d7dc" fill="#65d7dc" fontFamily="var(--studio-mono)">
          <path d="M 170 98 V 113 M 590 98 V 113 M 170 105 H 590" strokeWidth="1" />
          <text x="380" y="94" textAnchor="middle" fontSize="12">
            {formatSixteenths(measurements.wallA)}
          </text>
          <path d="M 126 145 H 140 M 126 390 H 140 M 133 145 V 390" strokeWidth="1" />
          <text x="116" y="270" textAnchor="middle" fontSize="12" transform="rotate(-90 116 270)">
            {formatSixteenths(measurements.wallB)}
          </text>
          <path d="M 620 145 H 635 M 620 465 H 635 M 628 145 V 465" strokeWidth="1" />
          <text x="648" y="305" textAnchor="middle" fontSize="12" transform="rotate(90 648 305)">
            {formatSixteenths(measurements.wallC)}
          </text>
        </g>

        <g>
          <rect x="323" y="139" width="104" height="12" fill="#4b8fae" />
          <text x="375" y="129" textAnchor="middle" fontFamily="var(--studio-mono)" fontSize="10" fill="#84bdd6">
            WINDOW {formatSixteenths(measurements.windowWidth)}
          </text>
        </g>

        <g stroke="#8d9691" strokeWidth="1.5">
          <rect x="278" y="151" width="88" height="62" rx="3" fill="#cdd6d1" />
          <rect x="366" y="151" width="68" height="62" rx="3" fill="#cad8dc" />
          <rect x="176" y="240" width="62" height="94" rx="3" fill="#d4d7d1" />
          <rect x="522" y="280" width="62" height="92" rx="3" fill="#d4d7d1" />
        </g>
        <g fontFamily="var(--studio-mono)" fontSize="10" fill="#303633" textAnchor="middle">
          <text x="322" y="186">SINK</text>
          <text x="400" y="186">DW</text>
          <text x="207" y="289" transform="rotate(-90 207 289)">FRIDGE</text>
          <text x="553" y="326" transform="rotate(90 553 326)">RANGE</text>
        </g>

        <g>
          <circle cx="311" cy="229" r="12" fill="#1d2425" stroke="#65d7dc" strokeWidth="1.5" />
          <circle cx="337" cy="229" r="12" fill="#1d2425" stroke="#65d7dc" strokeWidth="1.5" />
          <text x="311" y="232.5" textAnchor="middle" fontFamily="var(--studio-mono)" fontSize="8" fill="#65d7dc">D</text>
          <text x="337" y="232.5" textAnchor="middle" fontFamily="var(--studio-mono)" fontSize="8" fill="#65d7dc">W</text>
        </g>

        <text x="380" y="84" textAnchor="middle" fontFamily="var(--studio-mono)" fontSize="11" fill={wallStroke("A")}>
          Wall A
        </text>
        <text x="96" y="270" textAnchor="middle" fontFamily="var(--studio-mono)" fontSize="11" fill={wallStroke("B")} transform="rotate(-90 96 270)">
          Wall B
        </text>
        <text x="670" y="305" textAnchor="middle" fontFamily="var(--studio-mono)" fontSize="11" fill={wallStroke("C")} transform="rotate(90 670 305)">
          Wall C
        </text>
      </svg>

      <div className="absolute inset-0">
        {WALL_BUTTONS.map((wall) => (
          <button
            key={wall.id}
            type="button"
            aria-label={`Select ${wall.label}`}
            aria-pressed={selectedWall === wall.id}
            onClick={() => onSelectWall(wall.id)}
            className={cn(
              "absolute z-10 grid size-9 place-items-center rounded-full border font-mono text-[9px] outline-none backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:ring-[#65d7dc]",
              wall.position,
              selectedWall === wall.id
                ? "border-[#65d7dc] bg-[#65d7dc] text-[#101415]"
                : "border-white/15 bg-black/35 text-white/65 hover:border-white/30 hover:text-white"
            )}
          >
            {wall.id}
          </button>
        ))}
      </div>

      <span className="sr-only" aria-live="polite">
        {selectedObjectId
          ? `${selectedObjectId} selected on Wall ${selectedWall}`
          : `Wall ${selectedWall} selected`}
      </span>
    </div>
  );
}
