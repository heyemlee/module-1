import { useMemo, useState, useRef, useCallback, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Cabinet, ConfirmationItem, Round1Normalized } from "@/domain/round1";
import {
  allowedDragWallsForLayout,
  buildFloorPlan,
  type ApplianceShape,
  type FloorPlan,
  type PlanRect,
  type PositionOverrides,
  type PositionOverride,
  type Wall
} from "./floorplan/plan-geometry";
import {
  Corner,
  Island,
  Legend,
  Marker,
  Stamp,
  WallCorner,
  Walls
} from "./layout-preview-shapes";

type LayoutPreviewProps = {
  normalized: Round1Normalized;
  cabinets: Cabinet[];
  confirmationItems: ConfirmationItem[];
  positionOverrides: PositionOverrides;
  onPositionOverridesChange: Dispatch<SetStateAction<PositionOverrides>>;
  highlightDraggableItems: boolean;
  showPositionObjects: boolean;
  /** Optional external ref to the rendered SVG (for client-side rasterization). */
  svgRef?: RefObject<SVGSVGElement | null>;
  /**
   * Optional precomputed plan. When provided it is rendered as-is instead of
   * recomputing from inputs — used to bind the AI reference image to the exact
   * frozen `snapshot.floorPlan`.
   */
  plan?: FloorPlan;
  /**
   * Controls which intake-stage data is visible in the customer preview.
   * Defaults preserve the older boolean behavior for existing callers.
   */
  previewStage?: PreviewStage;
  /**
   * Clean geometry-only render for the AI reference image: no header chrome, no
   * MEP markers, no text labels, no drag/hover chrome. Appliance and opening
   * geometry is still drawn (and always shown, regardless of
   * `showPositionObjects`).
   */
  referenceMode?: boolean;
  showHeader?: boolean;
};

type PreviewStage = "room" | "openings" | "layout" | "appliances" | "adjust";

const INK = "#1f2937";
const LINE = "#334155";
const UNLABELED_APPLIANCE_SYMBOLS = new Set([
  "range",
  "sink",
  "hood",
  "dishwasher",
  "fridge"
]);
const UNLABELED_APPLIANCE_KEYS = new Set([
  "microwaveOvenCombo",
  "ovenMicrowaveStack",
  "wallOven"
]);

export function LayoutPreview({
  normalized,
  cabinets,
  confirmationItems,
  positionOverrides,
  onPositionOverridesChange,
  highlightDraggableItems,
  showPositionObjects,
  svgRef: externalSvgRef,
  plan: planProp,
  previewStage,
  referenceMode = false,
  showHeader = true
}: LayoutPreviewProps) {
  const [showMep, setShowMep] = useState(false);

  const internalSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = externalSvgRef ?? internalSvgRef;
  const computedPlan = useMemo(
    () => buildFloorPlan(normalized, cabinets, confirmationItems.length, positionOverrides),
    [cabinets, confirmationItems.length, normalized, positionOverrides]
  );
  // A precomputed plan (the frozen snapshot geometry) takes precedence so the
  // reference image is bound to exactly what was locked.
  const plan = planProp ?? computedPlan;
  const resolvedStage: PreviewStage = referenceMode
    ? "adjust"
    : previewStage ?? (showPositionObjects ? "adjust" : "room");
  const hasCabinetFill = cabinets.length > 0;
  const showCabinetFill = referenceMode || (resolvedStage === "adjust" && hasCabinetFill);
  const showOpenings = stageAtLeast(resolvedStage, "openings");
  const showLayoutGuide =
    stageAtLeast(resolvedStage, "layout") &&
    !showCabinetFill &&
    plan.layoutPreference !== "NO_PREFERENCE";
  const showAppliances = stageAtLeast(resolvedStage, "appliances");
  const enablePositionDragging = !referenceMode && resolvedStage === "adjust";

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
  }, []);

  type DragInfo = {
    id: string;
    startVal: number;
    startSvgPt: { x: number, y: number };
    axisOffset: number;
  };
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);

  const handlePointerDown = useCallback((id: string, wall: Wall, currentVal: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const pt = getSvgPoint(e.clientX, e.clientY);
    const horizontal = wall === "TOP" || wall === "BOTTOM";
    setDragInfo({
      id,
      startVal: currentVal,
      startSvgPt: pt,
      axisOffset: (horizontal ? pt.x : pt.y) - currentVal
    });
  }, [getSvgPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragInfo) return;
    const pt = getSvgPoint(e.clientX, e.clientY);
    const nextOverride = overrideFromPointer(plan, dragInfo.id, pt, dragInfo.axisOffset);
    onPositionOverridesChange((prev) => ({ ...prev, [dragInfo.id]: nextOverride }));
  }, [dragInfo, getSvgPoint, onPositionOverridesChange, plan]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragInfo) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch (err) {}
      setDragInfo(null);
    }
  }, [dragInfo]);

  const handlePrint = useCallback(() => {
    if (!svgRef.current) return;
    const svgStr = new XMLSerializer().serializeToString(svgRef.current);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Floor Plan</title>
            <style>
              body { margin: 0; padding: 20px; display: flex; justify-content: center; font-family: sans-serif; }
              svg { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
              @media print {
                @page { margin: 1cm; }
                body { padding: 0; }
                svg { border: none; }
              }
            </style>
          </head>
          <body>
            ${svgStr}
            <script>
              window.onload = () => {
                window.print();
                window.onafterprint = () => window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white relative">
      {showHeader && !referenceMode && (
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-950">
            Top-Down Layout Plan
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showMep}
              onChange={(e) => setShowMep(e.target.checked)}
              className="rounded border-slate-300 text-slate-950 focus:ring-slate-950"
            />
            Show MEP
          </label>
          <span className={`rounded px-2.5 py-1 text-xs font-bold ${
            confirmationItems.length > 0
              ? "bg-[var(--app-amber-soft)] text-[var(--app-amber)]"
              : "bg-[var(--app-green-soft)] text-[var(--app-green)]"
          }`}>
            {`${confirmationItems.length} confirmation${confirmationItems.length === 1 ? "" : "s"}`}
          </span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-950 transition-colors hover:bg-slate-200"
            title="Print Floor Plan"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print
          </button>
        </div>
      </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${plan.canvas.w} ${plan.canvas.h}`}
        role="img"
        aria-label="Round 1 top-down kitchen layout plan, black and white"
        className="block h-auto w-full bg-white touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <Walls plan={plan} />
        {showCabinetFill && plan.island && <Island rect={plan.island} referenceMode={referenceMode} />}

        {showCabinetFill && plan.corners.map((corner, index) => (
          <Corner key={`corner-${index}`} rect={corner} />
        ))}

        {showLayoutGuide && <LayoutGuide plan={plan} />}

        {showCabinetFill && plan.baseCabinets.map((cabinet, index) => (
          <rect
            key={`base-${index}`}
            data-base-cabinet={cabinet.code}
            x={cabinet.x}
            y={cabinet.y}
            width={cabinet.w}
            height={cabinet.h}
            fill="#ffffff"
            stroke={INK}
            strokeWidth="1.2"
          />
        ))}



        {showCabinetFill && plan.wallCorners?.map((corner, index) => (
          <WallCorner key={`wallcorner-${index}`} corner={corner} />
        ))}

        {enablePositionDragging && <DragFeedback plan={plan} draggingId={dragInfo?.id} />}

        {showAppliances && [...plan.appliances]
          .sort((a, b) => {
            const isDraggingA = !referenceMode && (dragInfo?.id === a.key || (a.key === "hood" && dragInfo?.id === "range"));
            const isDraggingB = !referenceMode && (dragInfo?.id === b.key || (b.key === "hood" && dragInfo?.id === "range"));
            if (isDraggingA && !isDraggingB) return 1;
            if (!isDraggingA && isDraggingB) return -1;
            return 0;
          })
          .map((appliance) => (
          <Appliance
            key={appliance.key}
            appliance={appliance}
            onPointerDown={enablePositionDragging ? handlePointerDown : undefined}
            dragging={!referenceMode && (dragInfo?.id === appliance.key || (appliance.key === "hood" && dragInfo?.id === "range"))}
            highlighted={enablePositionDragging && highlightDraggableItems && isHighlightableAppliance(appliance.key)}
            referenceMode={referenceMode}
            interactive={enablePositionDragging}
            canvasWidth={plan.canvas.w}
            roomY={plan.room.y}
          />
        ))}

        {showCabinetFill && plan.wallCabinets.map((cabinet, index) => {
          const inset = 2.5;
          return (
            <g key={`wall-${index}`}>
              <rect
                data-wall-cabinet={cabinet.code}
                x={cabinet.x}
                y={cabinet.y}
                width={cabinet.w}
                height={cabinet.h}
                fill="none"
                stroke="#000000"
                strokeWidth="1.5"
              />
              <rect
                x={cabinet.x + inset}
                y={cabinet.y + inset}
                width={cabinet.w - inset * 2}
                height={cabinet.h - inset * 2}
                fill="none"
                stroke="#000000"
                strokeWidth="1.2"
              />
            </g>
          );
        })}

        {showOpenings && (
          <Openings
            plan={plan}
            onPointerDown={enablePositionDragging ? handlePointerDown : undefined}
            draggingId={dragInfo?.id}
            highlighted={enablePositionDragging && highlightDraggableItems}
            referenceMode={referenceMode}
            interactive={enablePositionDragging}
          />
        )}

        {showAppliances && showMep && !referenceMode && plan.markers.map((marker, index) => (
          <Marker
            key={`marker-${index}`}
            cx={marker.cx}
            cy={marker.cy}
            letter={marker.letter}
          />
        ))}

        <Legend plan={plan} />
        <Stamp plan={plan} />
      </svg>
    </div>
  );
}

const PREVIEW_STAGE_ORDER: Record<PreviewStage, number> = {
  room: 0,
  openings: 1,
  layout: 2,
  appliances: 3,
  adjust: 4
};

function stageAtLeast(stage: PreviewStage, minimum: PreviewStage) {
  return PREVIEW_STAGE_ORDER[stage] >= PREVIEW_STAGE_ORDER[minimum];
}

function LayoutGuide({ plan }: { plan: FloorPlan }) {
  const walls =
    plan.layoutPreference === "NO_PREFERENCE"
      ? []
      : allowedDragWallsForLayout(plan.layoutPreference);
  const { x, y, w, h, thickness } = plan.room;
  const inset = thickness + 6;
  const guideDepth = 22;
  const color = "#fff0dc";
  const stroke = "#c56a16";

  const wallRects: Record<Wall, PlanRect> = {
    TOP: {
      x: x + inset,
      y: y + thickness + 8,
      w: w - inset * 2,
      h: guideDepth
    },
    BOTTOM: {
      x: x + inset,
      y: y + h - thickness - 8 - guideDepth,
      w: w - inset * 2,
      h: guideDepth
    },
    LEFT: {
      x: x + thickness + 8,
      y: y + inset,
      w: guideDepth,
      h: h - inset * 2
    },
    RIGHT: {
      x: x + w - thickness - 8 - guideDepth,
      y: y + inset,
      w: guideDepth,
      h: h - inset * 2
    }
  };

  return (
    <g pointerEvents="none" opacity="0.72">
      {walls.map((wall) => {
        const rect = wallRects[wall];
        return (
          <rect
            key={wall}
            data-layout-guide="wall"
            data-layout-wall={wall}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            rx="4"
            fill={color}
            stroke={stroke}
            strokeWidth="1.4"
            strokeDasharray="8 5"
          />
        );
      })}
      {plan.island && (
        <rect
          data-layout-guide="island"
          x={plan.island.x}
          y={plan.island.y}
          width={plan.island.w}
          height={plan.island.h}
          rx="5"
          fill="#f8fafc"
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray="7 5"
        />
      )}
      {plan.layoutPreference === "PENINSULA" && (
        <rect
          data-layout-guide="peninsula"
          x={x + thickness + 8}
          y={y + h - thickness - 110}
          width={guideDepth}
          height="96"
          rx="4"
          fill="#f8fafc"
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray="7 5"
        />
      )}
    </g>
  );
}

function DragFeedback({ plan, draggingId }: { plan: FloorPlan; draggingId?: string }) {
  if (!draggingId) return null;
  const { x, y, w, h, thickness } = plan.room;
  let allowed: Wall[] = [];
  if (draggingId === "door" || draggingId === "window") {
    allowed = ["TOP", "BOTTOM", "LEFT", "RIGHT"];
  } else {
    allowed = allowedDragWallsForLayout(plan.layoutPreference);
  }

  const insets = thickness;
  const strokeW = 6;
  const color = "#c56a16";
  
  return (
    <g pointerEvents="none" opacity="0.4">
      {allowed.includes("TOP") && <rect x={x + insets} y={y + insets} width={w - insets*2} height={strokeW} fill={color} />}
      {allowed.includes("BOTTOM") && <rect x={x + insets} y={y + h - insets - strokeW} width={w - insets*2} height={strokeW} fill={color} />}
      {allowed.includes("LEFT") && <rect x={x + insets} y={y + insets} width={strokeW} height={h - insets*2} fill={color} />}
      {allowed.includes("RIGHT") && <rect x={x + w - insets - strokeW} y={y + insets} width={strokeW} height={h - insets*2} fill={color} />}
    </g>
  );
}

function overrideFromPointer(
  plan: FloorPlan,
  id: string,
  pt: { x: number; y: number },
  axisOffset: number
): PositionOverride {
  const wall = nearestAllowedWall(plan, pt, id);
  const horizontal = wall === "TOP" || wall === "BOTTOM";
  const rawPosition = (horizontal ? pt.x : pt.y) - axisOffset;
  const centerTracked = id === "door";
  if (centerTracked) {
    return { wall, position: horizontal ? pt.x : pt.y };
  }
  return { wall, position: rawPosition };
}

function nearestAllowedWall(plan: FloorPlan, pt: { x: number; y: number }, id: string): Wall {
  const allowed = id === "door" || id === "window" 
    ? (["TOP", "BOTTOM", "LEFT", "RIGHT"] as Wall[])
    : allowedDragWallsForLayout(plan.layoutPreference);
  const { x, y, w, h, thickness } = plan.room;
  const inner = {
    left: x + thickness,
    right: x + w - thickness,
    top: y + thickness,
    bottom: y + h - thickness
  };
  const distances: Record<Wall, number> = {
    TOP: Math.abs(pt.y - inner.top),
    BOTTOM: Math.abs(pt.y - inner.bottom),
    LEFT: Math.abs(pt.x - inner.left),
    RIGHT: Math.abs(pt.x - inner.right)
  };

  return allowed
    .map((wall) => ({ wall, distance: distances[wall] }))
    .sort((a, b) => a.distance - b.distance)[0].wall;
}

function isHighlightableAppliance(key: string) {
  return ["sink", "range", "fridge", "dishwasher", "hood"].includes(key);
}

function Appliance({
  appliance,
  onPointerDown,
  dragging,
  highlighted,
  referenceMode,
  interactive,
  canvasWidth,
  roomY
}: {
  appliance: ApplianceShape;
  onPointerDown?: (id: string, wall: Wall, currentVal: number, e: React.PointerEvent) => void;
  dragging?: boolean;
  highlighted?: boolean;
  referenceMode?: boolean;
  interactive?: boolean;
  canvasWidth?: number;
  roomY?: number;
}) {
  const cx = appliance.x + appliance.w / 2;
  const cy = appliance.y + appliance.h / 2;
  const isHorizontal = appliance.wall === "TOP" || appliance.wall === "BOTTOM";
  const currentVal = isHorizontal ? appliance.x : appliance.y;
  const isHood = appliance.symbol === "hood";

  const tooltipW = Math.max(160, (appliance.label?.length || 0) * 8.5);
  const tooltipH = 32;
  const tRectX = canvasWidth ? canvasWidth / 2 - tooltipW / 2 : cx - tooltipW / 2;
  const tRectY = 12;
  const tTextX = canvasWidth ? canvasWidth / 2 : cx;
  const tTextY = tRectY + 21;

  // Clean reference: just the body rect + symbol glyph, no chrome, no label.
  if (referenceMode) {
    return (
      <g data-appliance-symbol={appliance.symbol}>
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
      </g>
    );
  }

  return (
    <g
      onPointerDown={
        interactive && onPointerDown
          ? (e) => onPointerDown(isHood ? "range" : appliance.key, appliance.wall, currentVal, e)
          : undefined
      }
      style={{ 
        cursor: interactive ? (dragging ? "grabbing" : "grab") : "default",
        pointerEvents: "auto" 
      }}
      className={`transition-opacity duration-100 ${interactive ? "group" : ""} ${dragging ? "opacity-60" : interactive ? "hover:opacity-80" : ""} ${highlighted ? "animate-pulse" : ""}`}
      data-appliance-symbol={appliance.symbol}
    >
      {interactive && (
      <rect
        x={appliance.x - 4}
        y={appliance.y - 4}
        width={appliance.w + 8}
        height={appliance.h + 8}
        rx="4"
        fill="none"
        stroke="#c56a16"
        strokeWidth="2"
        className={`opacity-0 ${dragging ? "opacity-100" : "group-hover:opacity-100"} transition-opacity`}
        pointerEvents="none"
      />
      )}
      {highlighted && (
        <rect
          x={appliance.x - 5}
          y={appliance.y - 5}
          width={appliance.w + 10}
          height={appliance.h + 10}
          rx="5"
          fill="none"
          stroke="#c56a16"
          strokeWidth="2.2"
          strokeDasharray="5 4"
          pointerEvents="none"
        />
      )}
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
      {shouldShowApplianceLabel(appliance) && (
        <text
          x={cx}
          y={cy + appliance.h / 2 - 6}
          textAnchor="middle"
          className="fill-slate-900 text-[11px] font-bold"
        >
          {appliance.label}
        </text>
      )}
      {interactive && (
      <g className={`opacity-0 ${dragging ? "opacity-100" : "group-hover:opacity-100"} transition-opacity`} pointerEvents="none">
        <circle cx={cx - 6} cy={isHorizontal ? cy + appliance.h/2 - 4 : cy} r="1.5" fill="#334155" />
        <circle cx={cx} cy={isHorizontal ? cy + appliance.h/2 - 4 : cy} r="1.5" fill="#334155" />
        <circle cx={cx + 6} cy={isHorizontal ? cy + appliance.h/2 - 4 : cy} r="1.5" fill="#334155" />
      </g>
      )}
      {interactive && appliance.label && (
        <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none drop-shadow-sm" style={{ pointerEvents: 'none' }}>
          <rect x={tRectX} y={tRectY} width={tooltipW} height={tooltipH} rx="4" fill="#0f172a" />
          <text x={tTextX} y={tTextY} textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="700" className="pointer-events-none tracking-wide">
            {appliance.label}
          </text>
        </g>
      )}
    </g>
  );
}

function shouldShowApplianceLabel(appliance: ApplianceShape): boolean {
  return (
    Boolean(appliance.label) &&
    !UNLABELED_APPLIANCE_SYMBOLS.has(appliance.symbol) &&
    !UNLABELED_APPLIANCE_KEYS.has(appliance.key)
  );
}

function ApplianceSymbol({ appliance }: { appliance: ApplianceShape }) {
  const { x, y, w, h, symbol, wall } = appliance;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (symbol === "range") {
    let fw = w;
    let fh = h;
    let fcx = cx;
    let fcy = y + h / 2;
    
    // Shift burners to the visible front 40% of the range (avoiding the hood)
    if (wall === "TOP") {
      fh = h * 0.42;
      fcy = y + h - fh / 2;
    } else if (wall === "BOTTOM") {
      fh = h * 0.42;
      fcy = y + fh / 2;
    } else if (wall === "LEFT") {
      fw = w * 0.42;
      fcx = x + w - fw / 2;
    } else if (wall === "RIGHT") {
      fw = w * 0.42;
      fcx = x + fw / 2;
    }

    const offX = Math.min(fw, fh) * 0.24;
    const offY = Math.min(fw, fh) * 0.24;
    const r = Math.min(fw, fh) * 0.16;
    return (
      <g fill="none" stroke={LINE} strokeWidth="1">
        <circle cx={fcx - offX} cy={fcy - offY} r={r} />
        <circle cx={fcx + offX} cy={fcy - offY} r={r} />
        <circle cx={fcx - offX} cy={fcy + offY} r={r} />
        <circle cx={fcx + offX} cy={fcy + offY} r={r} />
      </g>
    );
  }
  if (symbol === "dishwasher") {
    let nx = 0, ny = 1, tx = 1, ty = 0, cbx = cx, cby = y;
    let len = w, dep = h;
    
    if (wall === "TOP") {
      nx = 0; ny = 1; tx = 1; ty = 0; cbx = cx; cby = y; len = w; dep = h;
    } else if (wall === "BOTTOM") {
      nx = 0; ny = -1; tx = -1; ty = 0; cbx = cx; cby = y + h; len = w; dep = h;
    } else if (wall === "LEFT") {
      nx = 1; ny = 0; tx = 0; ty = -1; cbx = x; cby = cy; len = h; dep = w;
    } else if (wall === "RIGHT") {
      nx = -1; ny = 0; tx = 0; ty = 1; cbx = x + w; cby = cy; len = h; dep = w;
    }

    const pt = (l: number, d: number) => [cbx + tx * l + nx * d, cby + ty * l + ny * d];
    
    const handleW = len * 0.55; 
    const handleD = dep * 0.08; 
    const handleY = dep; 
    
    const hTL = pt(-handleW / 2, handleY);
    const hBR = pt(handleW / 2, handleY + handleD);

    const inset = Math.max(3, Math.min(len, dep) * 0.06);
    const panelX = x + inset;
    const panelY = y + inset;
    const panelW = Math.max(1, w - inset * 2);
    const panelH = Math.max(1, h - inset * 2);

    return (
      <g data-dishwasher-panel="true">
        <title>Dishwasher integrated base cabinet panel</title>
        <rect
          x={panelX}
          y={panelY}
          width={panelW}
          height={panelH}
          fill="none"
          stroke={LINE}
          strokeWidth="1.1"
          rx="2"
        />
        {wall === "TOP" || wall === "BOTTOM" ? (
          <line
            x1={panelX}
            y1={wall === "BOTTOM" ? panelY + panelH * 0.26 : panelY + panelH * 0.74}
            x2={panelX + panelW}
            y2={wall === "BOTTOM" ? panelY + panelH * 0.26 : panelY + panelH * 0.74}
            stroke={LINE}
            strokeWidth="0.9"
          />
        ) : (
          <line
            x1={wall === "RIGHT" ? panelX + panelW * 0.26 : panelX + panelW * 0.74}
            y1={panelY}
            x2={wall === "RIGHT" ? panelX + panelW * 0.26 : panelX + panelW * 0.74}
            y2={panelY + panelH}
            stroke={LINE}
            strokeWidth="0.9"
          />
        )}
        <rect
          x={Math.min(hTL[0], hBR[0])}
          y={Math.min(hTL[1], hBR[1])}
          width={Math.abs(hBR[0] - hTL[0])}
          height={Math.abs(hBR[1] - hTL[1])}
          fill="#ffffff"
          stroke={LINE}
          strokeWidth="1.2"
          rx="1.5"
        />
      </g>
    );
  }
  if (symbol === "sink") {
    let nx = 0, ny = 1, tx = 1, ty = 0, cbx = cx, cby = y;
    let len = w, dep = h;
    
    if (wall === "TOP") {
      nx = 0; ny = 1; tx = 1; ty = 0; cbx = cx; cby = y; len = w; dep = h;
    } else if (wall === "BOTTOM") {
      nx = 0; ny = -1; tx = -1; ty = 0; cbx = cx; cby = y + h; len = w; dep = h;
    } else if (wall === "LEFT") {
      nx = 1; ny = 0; tx = 0; ty = -1; cbx = x; cby = cy; len = h; dep = w;
    } else if (wall === "RIGHT") {
      nx = -1; ny = 0; tx = 0; ty = 1; cbx = x + w; cby = cy; len = h; dep = w;
    }

    const pt = (l: number, d: number) => [cbx + tx * l + nx * d, cby + ty * l + ny * d];
    
    const bW = len * 0.8;
    const bD = dep * 0.65;
    const bCenterD = dep * 0.55;
    const bTL = pt(-bW / 2, bCenterD - bD / 2);
    const bBR = pt(bW / 2, bCenterD + bD / 2);
    
    const apronY = dep * 0.90;
    const apronL = pt(-len / 2, apronY);
    const apronR = pt(len / 2, apronY);
    const apronTickL1 = pt(-len / 2 + len * 0.08, apronY);
    const apronTickL2 = pt(-len / 2 + len * 0.08, dep);

    const fBaseD = dep * 0.15;
    const fBase = pt(0, fBaseD);
    const fSpoutEnd = pt(0, fBaseD + dep * 0.25);
    const handleStart = pt(len * 0.06, fBaseD);
    const handleEnd = pt(len * 0.16, fBaseD);
    const handleTick = pt(len * 0.16, fBaseD + dep * 0.04);
    
    const soapD = bCenterD + bD / 2 - dep * 0.06;
    const soapL = bW / 2 + len * 0.04;
    const soapBase = pt(soapL, soapD);
    const soapSpout = pt(soapL - len * 0.08, soapD);

    return (
      <g fill="none" stroke={LINE} strokeWidth="1.2">
        <rect 
          x={Math.min(bTL[0], bBR[0])} 
          y={Math.min(bTL[1], bBR[1])} 
          width={Math.abs(bBR[0] - bTL[0])} 
          height={Math.abs(bBR[1] - bTL[1])} 
          rx="3" 
        />
        <line x1={apronL[0]} y1={apronL[1]} x2={apronR[0]} y2={apronR[1]} />
        
        <circle cx={fBase[0]} cy={fBase[1]} r={Math.min(len, dep) * 0.06} />
        <circle cx={fBase[0]} cy={fBase[1]} r={Math.min(len, dep) * 0.03} />
        <line x1={fBase[0]} y1={fBase[1]} x2={fSpoutEnd[0]} y2={fSpoutEnd[1]} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={handleStart[0]} y1={handleStart[1]} x2={handleEnd[0]} y2={handleEnd[1]} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={handleEnd[0]} y1={handleEnd[1]} x2={handleTick[0]} y2={handleTick[1]} strokeWidth="1.5" strokeLinecap="round" />
      </g>
    );
  }
  if (symbol === "fridge") {
    let nx = 0, ny = 1, tx = 1, ty = 0, cbx = cx, cby = y;
    let len = w, dep = h;
    
    if (wall === "TOP") {
      nx = 0; ny = 1; tx = 1; ty = 0; cbx = cx; cby = y; len = w; dep = h;
    } else if (wall === "BOTTOM") {
      nx = 0; ny = -1; tx = -1; ty = 0; cbx = cx; cby = y + h; len = w; dep = h;
    } else if (wall === "LEFT") {
      nx = 1; ny = 0; tx = 0; ty = -1; cbx = x; cby = cy; len = h; dep = w;
    } else if (wall === "RIGHT") {
      nx = -1; ny = 0; tx = 0; ty = 1; cbx = x + w; cby = cy; len = h; dep = w;
    }

    const pt = (l: number, d: number) => [cbx + tx * l + nx * d, cby + ty * l + ny * d];
    
    const doorD = dep * 0.18;
    const gap = 1;
    const inset = 1.5;
    
    const dl_pts = [pt(-len/2 + inset, dep - doorD), pt(-gap, dep - doorD), pt(-gap, dep - inset), pt(-len/2 + inset, dep - inset)];
    const dr_pts = [pt(gap, dep - doorD), pt(len/2 - inset, dep - doorD), pt(len/2 - inset, dep - inset), pt(gap, dep - inset)];
    
    const h1_0 = pt(-len * 0.1, dep - doorD * 0.5);
    const h1_1 = pt(-len * 0.1, dep - inset * 1.5);
    const h2_0 = pt(len * 0.1, dep - doorD * 0.5);
    const h2_1 = pt(len * 0.1, dep - inset * 1.5);

    const back_line_1 = pt(-len/2 + inset, dep * 0.12);
    const back_line_2 = pt(len/2 - inset, dep * 0.12);

    return (
      <g>
        <line x1={back_line_1[0]} y1={back_line_1[1]} x2={back_line_2[0]} y2={back_line_2[1]} stroke={LINE} strokeWidth="1" />
        <path d={`M ${dl_pts.map(p => p.join(",")).join(" L ")} Z`} fill="#e2e8f0" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
        <path d={`M ${dr_pts.map(p => p.join(",")).join(" L ")} Z`} fill="#e2e8f0" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
        <line x1={h1_0[0]} y1={h1_0[1]} x2={h1_1[0]} y2={h1_1[1]} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={h2_0[0]} y1={h2_0[1]} x2={h2_1[0]} y2={h2_1[1]} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }
  if (symbol === "oven") {
    const isHorizontal = wall === "TOP" || wall === "BOTTOM";
    return (
      <g fill="none" stroke={LINE} strokeWidth="1">
        {isHorizontal ? (
          <>
            <line x1={x + 5} y1={y + h * 0.35} x2={x + w - 5} y2={y + h * 0.35} />
            <line x1={x + 5} y1={y + h * 0.6} x2={x + w - 5} y2={y + h * 0.6} />
          </>
        ) : (
          <>
            <line x1={x + w * 0.35} y1={y + 5} x2={x + w * 0.35} y2={y + h - 5} />
            <line x1={x + w * 0.6} y1={y + 5} x2={x + w * 0.6} y2={y + h - 5} />
          </>
        )}
      </g>
    );
  }
  if (symbol === "microwave") {
    const isHorizontal = wall === "TOP" || wall === "BOTTOM";
    const windowX = isHorizontal ? w * 0.1 : w * 0.3;
    const windowY = isHorizontal ? h * 0.3 : h * 0.1;
    const windowW = isHorizontal ? w * 0.6 : w * 0.4;
    const windowH = isHorizontal ? h * 0.4 : h * 0.6;
    return (
      <g fill="none" stroke={LINE} strokeWidth="1">
        <rect x={x + windowX} y={y + windowY} width={windowW} height={windowH} rx="2" />
        {isHorizontal ? (
          <>
            <circle cx={x + w * 0.82} cy={y + h * 0.4} r="1" />
            <circle cx={x + w * 0.82} cy={y + h * 0.6} r="1" />
          </>
        ) : (
          <>
            <circle cx={x + w * 0.4} cy={y + h * 0.82} r="1" />
            <circle cx={x + w * 0.6} cy={y + h * 0.82} r="1" />
          </>
        )}
      </g>
    );
  }
  if (symbol === "hood") {
    const hw = w * 0.32;
    const hh = h * 0.32;
    return (
      <rect
        x={x + w / 2 - hw / 2}
        y={y + h / 2 - hh / 2}
        width={hw}
        height={hh}
        fill="none"
        stroke={LINE}
        strokeWidth="1.2"
      />
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

function Openings({
  plan,
  onPointerDown,
  draggingId,
  highlighted,
  referenceMode,
  interactive
}: {
  plan: FloorPlan;
  onPointerDown?: (id: string, wall: Wall, currentVal: number, e: React.PointerEvent) => void;
  draggingId?: string;
  highlighted?: boolean;
  referenceMode?: boolean;
  interactive?: boolean;
}) {
  return (
    <g>
      {plan.window && (
        <g
          data-opening-symbol="window"
          onPointerDown={
            interactive && onPointerDown
              ? (e) => onPointerDown("window", plan.window!.wall, plan.window!.wall === "TOP" || plan.window!.wall === "BOTTOM" ? plan.window!.x : plan.window!.y, e)
              : undefined
          }
          style={{ cursor: interactive ? (draggingId === "window" ? "grabbing" : "grab") : "default" }}
          className={`transition-opacity duration-100 ${interactive ? "group" : ""} ${draggingId === "window" ? "opacity-60" : interactive ? "hover:opacity-80" : ""} ${highlighted ? "animate-pulse" : ""}`}
        >
          {!referenceMode && interactive && (
          <rect
            x={plan.window.x - 4}
            y={plan.window.y - 4}
            width={plan.window.w + 8}
            height={plan.window.h + 8}
            rx="4"
            fill="none"
            stroke="#c56a16"
            strokeWidth="2"
            className={`opacity-0 ${draggingId === "window" ? "opacity-100" : "group-hover:opacity-100"} transition-opacity`}
            pointerEvents="none"
          />
          )}
          {highlighted && (
            <rect
              x={plan.window.x - 5}
              y={plan.window.y - 5}
              width={plan.window.w + 10}
              height={plan.window.h + 10}
              rx="5"
              fill="none"
              stroke="#c56a16"
              strokeWidth="2.2"
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}
          <rect
            x={plan.window.x}
            y={plan.window.y}
            width={plan.window.w}
            height={plan.window.h}
            fill="#ffffff"
          />
          {plan.window.wall === "TOP" || plan.window.wall === "BOTTOM" ? (
            <g>
              <line x1={plan.window.x} y1={plan.window.y} x2={plan.window.x + plan.window.w} y2={plan.window.y} stroke="#1d1d1f" strokeWidth="1.2" />
              <line x1={plan.window.x} y1={plan.window.y + plan.window.h / 2} x2={plan.window.x + plan.window.w} y2={plan.window.y + plan.window.h / 2} stroke="#1d1d1f" strokeWidth="1.2" />
              <line x1={plan.window.x} y1={plan.window.y + plan.window.h} x2={plan.window.x + plan.window.w} y2={plan.window.y + plan.window.h} stroke="#1d1d1f" strokeWidth="1.2" />
            </g>
          ) : (
            <g>
              <line x1={plan.window.x} y1={plan.window.y} x2={plan.window.x} y2={plan.window.y + plan.window.h} stroke="#1d1d1f" strokeWidth="1.2" />
              <line x1={plan.window.x + plan.window.w / 2} y1={plan.window.y} x2={plan.window.x + plan.window.w / 2} y2={plan.window.y + plan.window.h} stroke="#1d1d1f" strokeWidth="1.2" />
              <line x1={plan.window.x + plan.window.w} y1={plan.window.y} x2={plan.window.x + plan.window.w} y2={plan.window.y + plan.window.h} stroke="#1d1d1f" strokeWidth="1.2" />
            </g>
          )}
          {!referenceMode && (
          <text
            x={plan.window.wall === "LEFT" ? plan.window.x - 6 : (plan.window.wall === "RIGHT" ? plan.window.x + plan.window.w + 6 : plan.window.x + plan.window.w / 2)}
            y={plan.window.wall === "TOP" ? plan.window.y - 5 : (plan.window.wall === "BOTTOM" ? plan.window.y + plan.window.h + 12 : plan.window.y + plan.window.h / 2)}
            textAnchor={plan.window.wall === "LEFT" ? "end" : (plan.window.wall === "RIGHT" ? "start" : "middle")}
            dominantBaseline={plan.window.wall === "LEFT" || plan.window.wall === "RIGHT" ? "middle" : "auto"}
            className="fill-slate-500 text-[11px] font-bold"
          >
            window
          </text>
          )}
          {!referenceMode && interactive && (
          <g className={`opacity-0 ${draggingId === "window" ? "opacity-100" : "group-hover:opacity-100"} transition-opacity`} pointerEvents="none">
            <circle cx={plan.window.x + plan.window.w / 2 - 6} cy={plan.window.y + plan.window.h / 2} r="1.5" fill="#334155" />
            <circle cx={plan.window.x + plan.window.w / 2} cy={plan.window.y + plan.window.h / 2} r="1.5" fill="#334155" />
            <circle cx={plan.window.x + plan.window.w / 2 + 6} cy={plan.window.y + plan.window.h / 2} r="1.5" fill="#334155" />
          </g>
          )}
        </g>
      )}
      {plan.door && (
        <g
          data-opening-symbol="door"
          onPointerDown={
            interactive && onPointerDown
              ? (e) => onPointerDown("door", plan.door!.wall, plan.door!.wall === "TOP" || plan.door!.wall === "BOTTOM" ? plan.door!.cx : plan.door!.cy, e)
              : undefined
          }
          style={{ cursor: interactive ? (draggingId === "door" ? "grabbing" : "grab") : "default" }}
          className={`transition-opacity duration-100 ${interactive ? "group" : ""} ${draggingId === "door" ? "opacity-60" : interactive ? "hover:opacity-80" : ""} ${highlighted ? "animate-pulse" : ""}`}
        >
          {!referenceMode && interactive && (
          <rect
            x={plan.door.breakRect.x - 4}
            y={plan.door.breakRect.y - 4}
            width={plan.door.breakRect.w + 8}
            height={plan.door.breakRect.h + 8}
            rx="4"
            fill="none"
            stroke="#c56a16"
            strokeWidth="2"
            className={`opacity-0 ${draggingId === "door" ? "opacity-100" : "group-hover:opacity-100"} transition-opacity`}
            pointerEvents="none"
          />
          )}
          {highlighted && (
            <rect
              x={plan.door.breakRect.x - 5}
              y={plan.door.breakRect.y - 5}
              width={plan.door.breakRect.w + 10}
              height={plan.door.breakRect.h + 10}
              rx="5"
              fill="none"
              stroke="#c56a16"
              strokeWidth="2.2"
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}
          <rect
            x={plan.door.breakRect.x}
            y={plan.door.breakRect.y}
            width={plan.door.breakRect.w}
            height={plan.door.breakRect.h}
            fill="#ffffff"
          />
          {/* An open passage has no leaf or swing arc - only the wall gap. */}
          {plan.door.kind !== "OPEN_PASSAGE" && (
            <>
              <rect
                x={plan.door.leafRect.x}
                y={plan.door.leafRect.y}
                width={plan.door.leafRect.w}
                height={plan.door.leafRect.h}
                fill="none"
                stroke="#1d1d1f"
                strokeWidth="1.5"
              />
              <path d={plan.door.swingPath} fill="none" stroke="#1d1d1f" strokeWidth="1.2" />
            </>
          )}
          {!referenceMode && (
          <text
            x={plan.door.labelX}
            y={plan.door.labelY}
            textAnchor="middle"
            className="fill-slate-500 text-[11px] font-bold"
          >
            {plan.door.kind === "OPEN_PASSAGE" ? "opening" : "door"}
          </text>
          )}
          {!referenceMode && interactive && (
          <g className={`opacity-0 ${draggingId === "door" ? "opacity-100" : "group-hover:opacity-100"} transition-opacity`} pointerEvents="none">
            <circle cx={plan.door.cx - 6} cy={plan.door.cy} r="1.5" fill="#334155" />
            <circle cx={plan.door.cx} cy={plan.door.cy} r="1.5" fill="#334155" />
            <circle cx={plan.door.cx + 6} cy={plan.door.cy} r="1.5" fill="#334155" />
          </g>
          )}
        </g>
      )}
    </g>
  );
}
