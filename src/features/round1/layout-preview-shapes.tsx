import {
  type FloorPlan,
  type MarkerLetter,
  type PlanRect,
  type WallCornerShape
} from "./floorplan/plan-geometry";
import { INK, LINE, CABINET_FILL as FILL_CABINET } from "./floorplan/palette";

export function Walls({ plan }: { plan: FloorPlan }) {
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

export function Island({ rect, referenceMode }: { rect: PlanRect; referenceMode?: boolean }) {
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
      {!referenceMode && (
        <text
          x={rect.x + rect.w / 2}
          y={rect.y + rect.h / 2 + 4}
          textAnchor="middle"
          className="fill-slate-700 text-[12px] font-bold"
        >
          Island
        </text>
      )}
    </g>
  );
}

export function Corner({ rect }: { rect: PlanRect }) {
  return (
    <g>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1.2"
      />
    </g>
  );
}

export function WallCorner({ corner }: { corner: WallCornerShape }) {
  const { x, y, w, h, type, wallDepth } = corner;
  const inset = 2.5;

  let pts: number[][] = [];
  let inPts: number[][] = [];
  if (type === "TL") {
    pts = [[x, y], [x + w, y], [x + w, y + wallDepth], [x + wallDepth, y + wallDepth], [x + wallDepth, y + h], [x, y + h]];
    inPts = [
      [x + inset, y + inset],
      [x + w - inset, y + inset],
      [x + w - inset, y + wallDepth - inset],
      [x + wallDepth - inset, y + wallDepth - inset],
      [x + wallDepth - inset, y + h - inset],
      [x + inset, y + h - inset]
    ];
  } else if (type === "TR") {
    pts = [[x + w, y], [x + w, y + h], [x + w - wallDepth, y + h], [x + w - wallDepth, y + wallDepth], [x, y + wallDepth], [x, y]];
    inPts = [
      [x + w - inset, y + inset],
      [x + w - inset, y + h - inset],
      [x + w - wallDepth + inset, y + h - inset],
      [x + w - wallDepth + inset, y + wallDepth - inset],
      [x + inset, y + wallDepth - inset],
      [x + inset, y + inset]
    ];
  } else if (type === "BL") {
    pts = [[x, y + h], [x, y], [x + wallDepth, y], [x + wallDepth, y + h - wallDepth], [x + w, y + h - wallDepth], [x + w, y + h]];
    inPts = [
      [x + inset, y + h - inset],
      [x + inset, y + inset],
      [x + wallDepth - inset, y + inset],
      [x + wallDepth - inset, y + h - wallDepth + inset],
      [x + w - inset, y + h - wallDepth + inset],
      [x + w - inset, y + h - inset]
    ];
  } else if (type === "BR") {
    pts = [[x + w, y + h], [x, y + h], [x, y + h - wallDepth], [x + w - wallDepth, y + h - wallDepth], [x + w - wallDepth, y], [x + w, y]];
    inPts = [
      [x + w - inset, y + h - inset],
      [x + inset, y + h - inset],
      [x + inset, y + h - wallDepth + inset],
      [x + w - wallDepth + inset, y + h - wallDepth + inset],
      [x + w - wallDepth + inset, y + inset],
      [x + w - inset, y + inset]
    ];
  }

  const path = `M ${pts.map(p => p.join(",")).join(" L ")} Z`;
  const inPath = `M ${inPts.map(p => p.join(",")).join(" L ")} Z`;

  return (
    <g>
      <path d={path} fill="none" stroke="#000000" strokeWidth="1.5" />
      <path d={inPath} fill="none" stroke="#000000" strokeWidth="1.2" />
    </g>
  );
}

export function Marker({ cx, cy, letter }: { cx: number; cy: number; letter: MarkerLetter }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="10" fill="#ffffff" stroke={INK} strokeWidth="1.4" />
      <text x={cx} y={cy + 4} textAnchor="middle" className="text-[11px] font-black" fill={INK}>
        {letter}
      </text>
    </g>
  );
}

export function ConfirmationFlag({ plan }: { plan: FloorPlan }) {
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

export function Legend({ plan }: { plan: FloorPlan }) {
  return null;
}

export function Stamp({ plan }: { plan: FloorPlan }) {
  return null;
}
