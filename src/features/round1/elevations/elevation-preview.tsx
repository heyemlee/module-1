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
const OPENING = "#c56a16";
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
        <p className="text-xs font-bold uppercase tracking-wide text-slate-950">
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
  const isBase = item.kind === "baseCabinet";
  const isBaseLevel = item.y > 100;
  const hasToeKick = isBase || (item.symbol === "corner" && isBaseLevel);
  
  const toeKickH = 12;
  const isFiller = item.w < 14;

  return (
    <g data-elevation-item={item.symbol}>
      {hasToeKick && (
        <rect
          x={item.x}
          y={item.y + item.h}
          width={item.w}
          height={toeKickH}
          fill="#ffffff"
          stroke={INK}
          strokeWidth="1"
        />
      )}
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1"
      />
      {item.symbol === "corner" ? (
        <>
          <path
            d={`M ${item.x} ${item.y + item.h} L ${item.x + item.w} ${item.y}`}
            fill="none"
            stroke={INK}
            strokeWidth="0.8"
          />
          <path
            d={`M ${item.x} ${item.y} L ${item.x + item.w} ${item.y + item.h}`}
            fill="none"
            stroke={INK}
            strokeWidth="0.8"
          />
        </>
      ) : !isFiller ? (
        <>
          {isBase && item.h > 20 && (
            <>
              <line
                x1={item.x}
                y1={item.y + 12}
                x2={item.x + item.w}
                y2={item.y + 12}
                stroke={INK}
                strokeWidth="1"
              />
              <line x1={item.x + item.w / 2 - 5} y1={item.y + 6} x2={item.x + item.w / 2 + 5} y2={item.y + 6} stroke={INK} strokeWidth="1" />
            </>
          )}
          {item.w > 20 ? (
            <>
              <line
                x1={item.x + item.w / 2}
                y1={isBase ? item.y + 12 : item.y}
                x2={item.x + item.w / 2}
                y2={item.y + item.h}
                stroke={INK}
                strokeWidth="1"
              />
              <line x1={item.x + item.w / 2 - 6} y1={isBase ? item.y + 20 : item.y + item.h - 20} x2={item.x + item.w / 2 - 6} y2={isBase ? item.y + 30 : item.y + item.h - 10} stroke={INK} strokeWidth="1" />
              <line x1={item.x + item.w / 2 + 6} y1={isBase ? item.y + 20 : item.y + item.h - 20} x2={item.x + item.w / 2 + 6} y2={isBase ? item.y + 30 : item.y + item.h - 10} stroke={INK} strokeWidth="1" />
            </>
          ) : (
            <line x1={item.x + item.w - 6} y1={isBase ? item.y + 20 : item.y + item.h - 20} x2={item.x + item.w - 6} y2={isBase ? item.y + 30 : item.y + item.h - 10} stroke={INK} strokeWidth="1" />
          )}
        </>
      ) : null}
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
        fill="#f5f5f7"
        stroke={OPENING}
        strokeWidth="1"
      />
      {item.symbol === "window" && (
        <>
          <rect
            x={item.x + 3}
            y={item.y + 3}
            width={item.w - 6}
            height={item.h - 6}
            fill="none"
            stroke={OPENING}
            strokeWidth="1"
          />
          <line
            x1={item.x + item.w / 2}
            y1={item.y + 3}
            x2={item.x + item.w / 2}
            y2={item.y + item.h - 3}
            stroke={OPENING}
            strokeWidth="1"
          />
          <line
            x1={item.x + 3}
            y1={item.y + item.h / 2}
            x2={item.x + item.w - 3}
            y2={item.y + item.h / 2}
            stroke={OPENING}
            strokeWidth="1"
          />
        </>
      )}
      {item.symbol === "door" && (
        <>
          <rect
            x={item.x + 3}
            y={item.y + 3}
            width={item.w - 6}
            height={item.h - 3}
            fill="none"
            stroke={OPENING}
            strokeWidth="1"
          />
          <circle cx={item.x + item.w - 8} cy={item.y + item.h / 2} r={2} stroke={OPENING} fill="none" />
        </>
      )}
    </g>
  );
}

function ApplianceShape({ item }: { item: ElevationItem }) {
  if (item.symbol === "sink" || item.symbol === "hood") {
    return (
      <g data-elevation-appliance={item.symbol}>
        {renderApplianceSymbol(item)}
      </g>
    );
  }

  const needsToeKick = ["dishwasher", "fridge", "oven", "microwave", "cooktop"].includes(item.symbol);
  const toeKickH = 12;
  const toeKickInset = 3;
  const isRange = item.symbol === "range";
  const mainH = isRange ? item.h + 12 : item.h;

  return (
    <g data-elevation-appliance={item.symbol}>
      {needsToeKick && (
        <rect
          x={item.x + toeKickInset}
          y={item.y + item.h}
          width={Math.max(1, item.w - toeKickInset * 2)}
          height={toeKickH}
          fill="#ffffff"
          stroke={INK}
          strokeWidth="1"
        />
      )}
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={mainH}
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1"
      />
      {renderApplianceSymbol(item)}
    </g>
  );
}

function renderApplianceSymbol(item: ElevationItem) {
  if (item.symbol === "sink") {
    const cx = item.x + item.w / 2;
    const counterY = item.y;
    const toeKickH = 12;
    const toeKickInset = 3;
    
    return (
      <g stroke={INK} strokeWidth="1" fill="none">
        <rect
          x={item.x + toeKickInset}
          y={item.y + item.h}
          width={Math.max(1, item.w - toeKickInset * 2)}
          height={toeKickH}
          fill="#ffffff"
          stroke={INK}
        />
        <rect
          x={item.x}
          y={item.y}
          width={item.w}
          height={item.h}
          fill="#ffffff"
          stroke={INK}
        />
        <line x1={cx} y1={item.y + 16} x2={cx} y2={item.y + item.h} />
        <line x1={cx - 6} y1={item.y + 24} x2={cx - 6} y2={item.y + 34} />
        <line x1={cx + 6} y1={item.y + 24} x2={cx + 6} y2={item.y + 34} />

        <rect x={item.x + 4} y={counterY} width={item.w - 8} height={16} fill="#ffffff" stroke={INK} />
        <rect x={cx - 3} y={counterY - 4} width={6} height={4} fill="#ffffff" />
        <path d={`M ${cx} ${counterY - 4} L ${cx} ${counterY - 18} A 6 6 0 0 1 ${cx + 12} ${counterY - 18} L ${cx + 12} ${counterY - 12}`} />
        <line x1={cx + 3} y1={counterY - 8} x2={cx + 8} y2={counterY - 10} />
      </g>
    );
  }

  if (item.symbol === "range") {
    const y = item.y;
    const w = item.w;
    const h = item.h + 12;
    return (
      <g fill="none" stroke={INK} strokeWidth="1">
        <rect x={item.x - 2} y={y} width={w + 4} height={4} fill="#ffffff" />
        <rect x={item.x} y={y + 4} width={w} height={10} />
        <circle cx={item.x + w * 0.2} cy={y + 9} r={2} />
        <circle cx={item.x + w * 0.35} cy={y + 9} r={2} />
        <circle cx={item.x + w * 0.65} cy={y + 9} r={2} />
        <circle cx={item.x + w * 0.8} cy={y + 9} r={2} />
        <rect x={item.x + 4} y={y + 18} width={w - 8} height={h - 26} />
        <rect x={item.x + 10} y={y + 24} width={w - 20} height={16} />
        <line x1={item.x + 8} y1={y + 20} x2={item.x + w - 8} y2={y + 20} strokeWidth="1.5" />
      </g>
    );
  }

  if (item.symbol === "cooktop") {
    // Reuses the range burner surface but draws a base cabinet front below
    // instead of an oven door: cooktop = burners only, no oven.
    const y = item.y;
    const w = item.w;
    return (
      <g fill="none" stroke={INK} strokeWidth="1">
        <rect x={item.x - 2} y={y} width={w + 4} height={4} fill="#ffffff" />
        <rect x={item.x} y={y + 4} width={w} height={10} />
        <circle cx={item.x + w * 0.2} cy={y + 9} r={2} />
        <circle cx={item.x + w * 0.35} cy={y + 9} r={2} />
        <circle cx={item.x + w * 0.65} cy={y + 9} r={2} />
        <circle cx={item.x + w * 0.8} cy={y + 9} r={2} />
        <line x1={item.x + 3} y1={y + 22} x2={item.x + w - 3} y2={y + 22} />
      </g>
    );
  }

  if (item.symbol === "fridge") {
    const splitY = item.y + item.h * 0.65;
    const cx = item.x + item.w / 2;
    return (
      <g fill="none" stroke={INK} strokeWidth="1">
        <line x1={item.x} y1={splitY} x2={item.x + item.w} y2={splitY} />
        <line x1={cx} y1={item.y} x2={cx} y2={splitY} />
        <line x1={cx - 4} y1={splitY - 30} x2={cx - 4} y2={splitY - 10} strokeWidth="1.5" />
        <line x1={cx + 4} y1={splitY - 30} x2={cx + 4} y2={splitY - 10} strokeWidth="1.5" />
        <line x1={item.x + item.w * 0.3} y1={splitY + 8} x2={item.x + item.w * 0.7} y2={splitY + 8} strokeWidth="1.5" />
      </g>
    );
  }

  if (item.symbol === "dishwasher") {
    const w = item.w;
    return (
      <g fill="none" stroke={INK} strokeWidth="1">
        <rect x={item.x} y={item.y} width={w} height={10} />
        <line x1={item.x + w * 0.2} y1={item.y + 16} x2={item.x + w * 0.8} y2={item.y + 16} strokeWidth="1.5" />
      </g>
    );
  }

  if (item.symbol === "oven") {
    const ovenY = item.y + item.h * 0.4;
    const ovenH = 40;
    return (
      <g fill="none" stroke={INK} strokeWidth="1">
        <rect x={item.x} y={item.y} width={item.w} height={item.h * 0.4} />
        <rect x={item.x + 4} y={ovenY} width={item.w - 8} height={ovenH} />
        <rect x={item.x + 8} y={ovenY + 8} width={item.w - 16} height={ovenH - 16} />
        <line x1={item.x + 10} y1={ovenY + 5} x2={item.x + item.w - 10} y2={ovenY + 5} strokeWidth="1.5" />
        <rect x={item.x} y={ovenY + ovenH} width={item.w} height={item.h - (ovenY + ovenH - item.y)} />
      </g>
    );
  }

  if (item.symbol === "microwave") {
    const microwaveY = item.y + item.h * 0.4;
    const microwaveH = 30;
    return (
      <g fill="none" stroke={INK} strokeWidth="1">
        <rect x={item.x} y={item.y} width={item.w} height={item.h * 0.4} />
        <rect x={item.x + 4} y={microwaveY} width={item.w - 8} height={microwaveH} />
        <rect x={item.x + 8} y={microwaveY + 6} width={item.w * 0.6} height={microwaveH - 12} />
        <circle cx={item.x + item.w - 12} cy={microwaveY + 12} r={1.5} />
        <circle cx={item.x + item.w - 12} cy={microwaveY + 18} r={1.5} />
        <rect x={item.x} y={microwaveY + microwaveH} width={item.w} height={item.h - (microwaveY + microwaveH - item.y)} />
      </g>
    );
  }

  if (item.symbol === "hood") {
    const cx = item.x + item.w / 2;
    const chimneyW = Math.min(20, item.w * 0.4);
    return (
      <g fill="none" stroke={INK} strokeWidth="1">
        <rect x={cx - chimneyW / 2} y={0} width={chimneyW} height={item.y} fill="#ffffff" />
        <path
          d={`M ${item.x} ${item.y + item.h} L ${item.x + item.w} ${item.y + item.h} L ${item.x + item.w * 0.8} ${item.y} L ${item.x + item.w * 0.2} ${item.y} Z`}
          fill="#ffffff"
        />
        <rect x={item.x} y={item.y + item.h - 6} width={item.w} height={6} />
      </g>
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
