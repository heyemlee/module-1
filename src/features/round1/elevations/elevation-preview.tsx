import type { RefObject } from "react";
import type { FloorPlan } from "../floorplan/plan-geometry";
import {
  buildElevationScene,
  ELEVATION_FLOOR_Y,
  type ElevationItem,
  type WallElevationScene
} from "./elevation-scene";

type ElevationPreviewProps = {
  plan: FloorPlan;
  svgRef?: RefObject<SVGSVGElement | null>;
  className?: string;
};

const INK = "#1f2937";
const MUTED = "#64748b";
const GUIDE = "#cbd5e1";
const OPENING = "#0ea5e9";
const PANEL_COLUMNS = 2;
const PANEL_GAP_X = 28;
const PANEL_GAP_Y = 20;
const PANEL_MARGIN = 18;
const PANEL_HEADER_H = 38;
const STAMP = "Round 1 rough elevation - not for production";

export function ElevationPreview({ plan, svgRef, className }: ElevationPreviewProps) {
  const scenes = buildElevationScene(plan);
  if (scenes.length === 0) return null;

  const panelWidth = scenes[0]?.width ?? 680;
  const panelHeight = (scenes[0]?.height ?? 230) + PANEL_HEADER_H;
  const rows = Math.ceil(scenes.length / PANEL_COLUMNS);
  const svgWidth = PANEL_MARGIN * 2 + panelWidth * PANEL_COLUMNS + PANEL_GAP_X;
  const svgHeight = PANEL_MARGIN * 2 + panelHeight * rows + PANEL_GAP_Y * Math.max(0, rows - 1);
  const sectionClassName = [
    "overflow-hidden rounded-lg border border-slate-200 bg-white",
    className
  ].filter(Boolean).join(" ");

  return (
    <section className={sectionClassName}>
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
          Rough Wall Elevations
        </p>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        role="img"
        aria-label="Round 1 rough wall elevations, not for production"
        className="block h-auto w-full bg-white"
      >
        {scenes.map((scene, index) => {
          const col = index % PANEL_COLUMNS;
          const row = Math.floor(index / PANEL_COLUMNS);
          const x = PANEL_MARGIN + col * (panelWidth + PANEL_GAP_X);
          const y = PANEL_MARGIN + row * (panelHeight + PANEL_GAP_Y);

          return (
            <WallPanel
              key={scene.wall}
              scene={scene}
              x={x}
              y={y}
            />
          );
        })}
      </svg>
    </section>
  );
}

function WallPanel({ scene, x, y }: { scene: WallElevationScene; x: number; y: number }) {
  return (
    <g data-elevation-wall={scene.wall} transform={`translate(${x} ${y})`}>
      <text x="0" y="13" fill={INK} fontSize="14" fontWeight="700">
        {scene.title}
      </text>
      <text x="0" y="30" fill={MUTED} fontSize="10" fontWeight="600">
        {STAMP}
      </text>
      <g transform={`translate(0 ${PANEL_HEADER_H})`}>
        <rect
          x="0"
          y="0"
          width={scene.width}
          height={scene.height}
          fill="#ffffff"
          stroke={GUIDE}
          strokeWidth="1"
        />
        <line
          x1="18"
          y1={ELEVATION_FLOOR_Y}
          x2={scene.width - 18}
          y2={ELEVATION_FLOOR_Y}
          stroke={INK}
          strokeWidth="1.3"
        />
        <line
          x1="18"
          y1="36"
          x2="18"
          y2={ELEVATION_FLOOR_Y}
          stroke={GUIDE}
          strokeWidth="1"
        />
        <line
          x1={scene.width - 18}
          y1="36"
          x2={scene.width - 18}
          y2={ELEVATION_FLOOR_Y}
          stroke={GUIDE}
          strokeWidth="1"
        />
        {scene.items.map((item) => (
          <ElevationShape key={item.key} item={item} />
        ))}
      </g>
    </g>
  );
}

function ElevationShape({ item }: { item: ElevationItem }) {
  if (item.kind === "opening") return <OpeningShape item={item} />;
  if (item.kind === "appliance") return <ApplianceShape item={item} />;
  return <CabinetShape item={item} />;
}

function CabinetShape({ item }: { item: ElevationItem }) {
  const innerInset = item.kind === "wallCabinet" ? 4 : 3;

  return (
    <g data-elevation-item={item.symbol}>
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1.2"
      />
      {item.w > 24 && item.h > 18 && (
        <rect
          x={item.x + innerInset}
          y={item.y + innerInset}
          width={Math.max(4, item.w - innerInset * 2)}
          height={Math.max(4, item.h - innerInset * 2)}
          fill="none"
          stroke={INK}
          strokeWidth="0.8"
        />
      )}
      {item.symbol === "corner" && (
        <path
          d={`M ${item.x} ${item.y + item.h} L ${item.x + item.w} ${item.y}`}
          fill="none"
          stroke={INK}
          strokeWidth="0.9"
        />
      )}
    </g>
  );
}

function OpeningShape({ item }: { item: ElevationItem }) {
  return (
    <g data-elevation-opening={item.symbol}>
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        fill="#f0f9ff"
        stroke={OPENING}
        strokeWidth="1.6"
      />
      {item.symbol === "window" && (
        <>
          <line
            x1={item.x + item.w / 2}
            y1={item.y}
            x2={item.x + item.w / 2}
            y2={item.y + item.h}
            stroke={OPENING}
            strokeWidth="1"
          />
          <line
            x1={item.x}
            y1={item.y + item.h / 2}
            x2={item.x + item.w}
            y2={item.y + item.h / 2}
            stroke={OPENING}
            strokeWidth="1"
          />
        </>
      )}
    </g>
  );
}

function ApplianceShape({ item }: { item: ElevationItem }) {
  return (
    <g data-elevation-appliance={item.symbol}>
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1.4"
      />
      {renderApplianceSymbol(item)}
    </g>
  );
}

function renderApplianceSymbol(item: ElevationItem) {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;

  if (item.symbol === "sink") {
    return (
      <ellipse
        cx={cx}
        cy={cy}
        rx={Math.max(7, item.w * 0.28)}
        ry={Math.max(5, item.h * 0.18)}
        fill="none"
        stroke={INK}
        strokeWidth="1"
      />
    );
  }

  if (item.symbol === "range") {
    const burnerR = Math.max(2.5, Math.min(5, item.w * 0.06));
    return (
      <>
        <circle cx={item.x + item.w * 0.36} cy={cy - 6} r={burnerR} fill="none" stroke={INK} strokeWidth="1" />
        <circle cx={item.x + item.w * 0.64} cy={cy - 6} r={burnerR} fill="none" stroke={INK} strokeWidth="1" />
        <circle cx={item.x + item.w * 0.36} cy={cy + 7} r={burnerR} fill="none" stroke={INK} strokeWidth="1" />
        <circle cx={item.x + item.w * 0.64} cy={cy + 7} r={burnerR} fill="none" stroke={INK} strokeWidth="1" />
      </>
    );
  }

  if (item.symbol === "fridge") {
    return (
      <>
        <line
          x1={item.x}
          y1={item.y + item.h * 0.42}
          x2={item.x + item.w}
          y2={item.y + item.h * 0.42}
          stroke={INK}
          strokeWidth="1"
        />
        <line
          x1={item.x + item.w * 0.82}
          y1={item.y + 10}
          x2={item.x + item.w * 0.82}
          y2={item.y + item.h * 0.35}
          stroke={INK}
          strokeWidth="1"
        />
        <line
          x1={item.x + item.w * 0.82}
          y1={item.y + item.h * 0.5}
          x2={item.x + item.w * 0.82}
          y2={item.y + item.h - 10}
          stroke={INK}
          strokeWidth="1"
        />
      </>
    );
  }

  if (item.symbol === "hood") {
    return (
      <path
        d={`M ${item.x + item.w * 0.2} ${item.y + item.h * 0.75} L ${item.x + item.w * 0.8} ${item.y + item.h * 0.75} L ${item.x + item.w * 0.62} ${item.y + item.h * 0.25} L ${item.x + item.w * 0.38} ${item.y + item.h * 0.25} Z`}
        fill="none"
        stroke={INK}
        strokeWidth="1"
      />
    );
  }

  return (
    <line
      x1={item.x + 5}
      y1={item.y + item.h - 7}
      x2={item.x + item.w - 5}
      y2={item.y + 7}
      stroke={INK}
      strokeWidth="1"
    />
  );
}
