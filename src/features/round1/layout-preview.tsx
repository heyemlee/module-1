import { useMemo } from "react";
import type { Cabinet, ConfirmationItem, Round1Normalized } from "@/domain/round1";
import {
  buildFloorPlan,
  type ApplianceShape,
  type FloorPlan,
  type MarkerLetter,
  type PlanRect
} from "./floorplan/plan-geometry";

type LayoutPreviewProps = {
  normalized: Round1Normalized;
  cabinets: Cabinet[];
  confirmationItems: ConfirmationItem[];
};

const INK = "#1f2937";
const LINE = "#334155";
const LINE_SOFT = "#94a3b8";
const FILL_CABINET = "#f1f5f9";
const FILL_CORNER = "#e2e8f0";

export function LayoutPreview({
  normalized,
  cabinets,
  confirmationItems
}: LayoutPreviewProps) {
  const plan = useMemo(
    () => buildFloorPlan(normalized, cabinets, confirmationItems.length),
    [cabinets, confirmationItems.length, normalized]
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
            Top-Down Layout Plan
          </p>
          <p className="text-sm text-slate-500">
            Approximate positions · {plan.scaleNote}
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          Round 1
        </span>
      </div>
      <svg
        viewBox={`0 0 ${plan.canvas.w} ${plan.canvas.h}`}
        role="img"
        aria-label="Round 1 top-down kitchen layout plan, black and white"
        className="block h-auto w-full bg-white"
      >
        <Walls plan={plan} />
        {plan.island && <Island rect={plan.island} />}

        {plan.corners.map((corner, index) => (
          <Corner key={`corner-${index}`} rect={corner} />
        ))}

        {plan.baseCabinets.map((cabinet, index) => (
          <rect
            key={`base-${index}`}
            x={cabinet.x}
            y={cabinet.y}
            width={cabinet.w}
            height={cabinet.h}
            fill={FILL_CABINET}
            stroke={LINE}
            strokeWidth="1.2"
          />
        ))}

        {plan.wallCabinets.map((cabinet, index) => (
          <rect
            key={`wall-${index}`}
            x={cabinet.x}
            y={cabinet.y}
            width={cabinet.w}
            height={cabinet.h}
            fill="none"
            stroke={LINE_SOFT}
            strokeWidth="1.2"
            strokeDasharray="6 4"
          />
        ))}

        {plan.appliances.map((appliance) => (
          <Appliance key={appliance.key} appliance={appliance} />
        ))}

        <Openings plan={plan} />

        {plan.markers.map((marker, index) => (
          <Marker
            key={`marker-${index}`}
            cx={marker.cx}
            cy={marker.cy}
            letter={marker.letter}
          />
        ))}

        <ConfirmationFlag plan={plan} />
        <Legend plan={plan} />
        <Stamp plan={plan} />
      </svg>
    </div>
  );
}

function Walls({ plan }: { plan: FloorPlan }) {
  const { x, y, w, h, thickness } = plan.room;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke="none" />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth="2.5" />
      <rect
        x={x + thickness}
        y={y + thickness}
        width={w - thickness * 2}
        height={h - thickness * 2}
        fill="none"
        stroke={INK}
        strokeWidth="1.5"
      />
    </g>
  );
}

function Island({ rect }: { rect: PlanRect }) {
  return (
    <g>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill={FILL_CABINET}
        stroke={LINE}
        strokeWidth="1.2"
      />
      <text
        x={rect.x + rect.w / 2}
        y={rect.y + rect.h / 2 + 4}
        textAnchor="middle"
        className="fill-slate-700 text-[12px] font-bold"
      >
        Island
      </text>
    </g>
  );
}

function Corner({ rect }: { rect: PlanRect }) {
  return (
    <g>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill={FILL_CORNER}
        stroke={LINE}
        strokeWidth="1.2"
      />
      <path
        d={`M${rect.x + rect.w},${rect.y} A${rect.w},${rect.h} 0 0 0 ${rect.x},${rect.y + rect.h}`}
        fill="none"
        stroke={LINE}
        strokeWidth="1"
      />
      <circle cx={rect.x + rect.w} cy={rect.y + rect.h} r="3.5" fill="none" stroke={LINE} strokeWidth="1" />
    </g>
  );
}

function Appliance({ appliance }: { appliance: ApplianceShape }) {
  const cx = appliance.x + appliance.w / 2;
  const cy = appliance.y + appliance.h / 2;
  return (
    <g>
      <rect
        x={appliance.x}
        y={appliance.y}
        width={appliance.w}
        height={appliance.h}
        rx="2"
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1.3"
      />
      <ApplianceSymbol appliance={appliance} />
      <text
        x={cx}
        y={cy + appliance.h / 2 - 6}
        textAnchor="middle"
        className="fill-slate-900 text-[11px] font-bold"
      >
        {appliance.label}
      </text>
    </g>
  );
}

function ApplianceSymbol({ appliance }: { appliance: ApplianceShape }) {
  const { x, y, w, h, symbol } = appliance;
  const cx = x + w / 2;
  const cy = y + h * 0.4;
  if (symbol === "range") {
    const offX = Math.min(w, h) * 0.18;
    const offY = Math.min(w, h) * 0.16;
    const r = Math.min(w, h) * 0.1;
    return (
      <g fill="none" stroke={LINE} strokeWidth="1">
        <circle cx={cx - offX} cy={cy - offY} r={r} />
        <circle cx={cx + offX} cy={cy - offY} r={r} />
        <circle cx={cx - offX} cy={cy + offY} r={r} />
        <circle cx={cx + offX} cy={cy + offY} r={r} />
      </g>
    );
  }
  if (symbol === "sink") {
    return (
      <g fill="none" stroke={LINE} strokeWidth="1">
        <rect x={x + w * 0.18} y={y + h * 0.18} width={w * 0.64} height={h * 0.42} rx="3" />
        <circle cx={cx} cy={y + h * 0.39} r="2.5" fill={LINE} />
      </g>
    );
  }
  if (symbol === "fridge") {
    return <line x1={x + w / 2} y1={y + 4} x2={x + w / 2} y2={y + h - 4} stroke={LINE} strokeWidth="1" />;
  }
  if (symbol === "oven") {
    return (
      <g fill="none" stroke={LINE} strokeWidth="1">
        <line x1={x + 5} y1={y + h * 0.35} x2={x + w - 5} y2={y + h * 0.35} />
        <line x1={x + 5} y1={y + h * 0.6} x2={x + w - 5} y2={y + h * 0.6} />
      </g>
    );
  }
  return (
    <rect
      x={x + w * 0.16}
      y={y + h * 0.16}
      width={w * 0.68}
      height={h * 0.45}
      rx="2"
      fill="none"
      stroke={LINE}
      strokeWidth="0.9"
      strokeDasharray="4 3"
    />
  );
}

function Openings({ plan }: { plan: FloorPlan }) {
  return (
    <g>
      {plan.window && (
        <g>
          <rect
            x={plan.window.x}
            y={plan.window.y}
            width={plan.window.w}
            height={plan.window.h}
            fill="#ffffff"
          />
          <line
            x1={plan.window.x}
            y1={plan.window.y + plan.window.h / 2}
            x2={plan.window.x + plan.window.w}
            y2={plan.window.y + plan.window.h / 2}
            stroke={INK}
            strokeWidth="1.2"
          />
          <text
            x={plan.window.x + plan.window.w / 2}
            y={plan.window.y - 5}
            textAnchor="middle"
            className="fill-slate-500 text-[11px] font-bold"
          >
            window
          </text>
        </g>
      )}
      {plan.door && (
        <g>
          <rect
            x={plan.door.breakRect.x}
            y={plan.door.breakRect.y}
            width={plan.door.breakRect.w}
            height={plan.door.breakRect.h}
            fill="#ffffff"
          />
          <path d={plan.door.swingPath} fill="none" stroke={LINE_SOFT} strokeWidth="1.2" />
          <text
            x={plan.door.labelX}
            y={plan.door.labelY}
            textAnchor="middle"
            className="fill-slate-500 text-[11px] font-bold"
          >
            door
          </text>
        </g>
      )}
    </g>
  );
}

function Marker({ cx, cy, letter }: { cx: number; cy: number; letter: MarkerLetter }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="10" fill="#ffffff" stroke={INK} strokeWidth="1.4" />
      <text x={cx} y={cy + 4} textAnchor="middle" className="text-[11px] font-black" fill={INK}>
        {letter}
      </text>
    </g>
  );
}

function ConfirmationFlag({ plan }: { plan: FloorPlan }) {
  if (plan.confirmationCount === 0) return null;
  const label = `${plan.confirmationCount} to confirm`;
  const width = 44 + label.length * 6.2;
  const x = 22;
  const y = 24;
  return (
    <g>
      <rect x={x} y={y} width={width} height={22} rx="11" fill="#ffffff" stroke={INK} strokeWidth="1.3" />
      <circle cx={x + 14} cy={y + 11} r="7" fill="none" stroke={INK} strokeWidth="1.3" />
      <text x={x + 14} y={y + 15} textAnchor="middle" className="text-[11px] font-black" fill={INK}>
        !
      </text>
      <text x={x + 27} y={y + 15} className="fill-slate-800 text-[11px] font-bold">
        {label}
      </text>
    </g>
  );
}

function Legend({ plan }: { plan: FloorPlan }) {
  const y = plan.canvas.h - 26;
  return (
    <g className="text-[11px] font-bold">
      <rect x={24} y={y - 9} width={14} height={11} fill={FILL_CABINET} stroke={LINE} strokeWidth="1" />
      <text x={44} y={y} className="fill-slate-600">cabinet</text>
      <rect x={104} y={y - 9} width={14} height={11} fill="none" stroke={LINE_SOFT} strokeWidth="1.2" strokeDasharray="4 3" />
      <text x={124} y={y} className="fill-slate-600">wall cabinet</text>
      <rect x={206} y={y - 9} width={14} height={11} fill="#ffffff" stroke={INK} strokeWidth="1.2" />
      <text x={226} y={y} className="fill-slate-600">appliance</text>
    </g>
  );
}

function Stamp({ plan }: { plan: FloorPlan }) {
  return (
    <g textAnchor="end">
      <text x={plan.canvas.w - 24} y={plan.canvas.h - 26} className="fill-slate-900 text-[13px] font-black">
        Round 1 · Sales Estimate Only
      </text>
      <text x={plan.canvas.w - 24} y={plan.canvas.h - 11} className="fill-slate-600 text-[11px] font-bold">
        Not production data · positions approximate
      </text>
    </g>
  );
}
