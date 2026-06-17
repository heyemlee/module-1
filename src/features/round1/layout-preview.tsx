import { useMemo, useState, useRef, useCallback } from "react";
import type { Cabinet, ConfirmationItem, Round1Normalized } from "@/domain/round1";
import {
  buildFloorPlan,
  type ApplianceShape,
  type FloorPlan,
  type MarkerLetter,
  type PlanRect,
  type WallCornerShape,
  type PositionOverrides,
  type Wall
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
  const [showMep, setShowMep] = useState(false);
  const [overrides, setOverrides] = useState<PositionOverrides>({});

  const svgRef = useRef<SVGSVGElement>(null);

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
    wall: Wall;
    startVal: number;
    startSvgPt: { x: number, y: number };
  };
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);

  const handlePointerDown = useCallback((id: string, wall: Wall, currentVal: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const pt = getSvgPoint(e.clientX, e.clientY);
    setDragInfo({ id, wall, startVal: currentVal, startSvgPt: pt });
  }, [getSvgPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragInfo) return;
    const pt = getSvgPoint(e.clientX, e.clientY);
    const dx = pt.x - dragInfo.startSvgPt.x;
    const dy = pt.y - dragInfo.startSvgPt.y;
    
    let newVal = dragInfo.startVal;
    if (dragInfo.wall === "TOP" || dragInfo.wall === "BOTTOM") {
      newVal += dx;
    } else {
      newVal += dy;
    }
    
    setOverrides(prev => ({ ...prev, [dragInfo.id]: newVal }));
  }, [dragInfo, getSvgPoint]);

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

  const plan = useMemo(
    () => buildFloorPlan(normalized, cabinets, confirmationItems.length, overrides),
    [cabinets, confirmationItems.length, normalized, overrides]
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white relative">
      {Object.keys(overrides).length > 0 && (
        <button
          onClick={() => setOverrides({})}
          className="absolute bottom-4 left-4 z-10 rounded bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow border border-slate-200 hover:bg-slate-50"
        >
          Reset Positions
        </button>
      )}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
            Top-Down Layout Plan
          </p>
          <p className="text-sm text-slate-500">
            Approximate positions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showMep}
              onChange={(e) => setShowMep(e.target.checked)}
              className="rounded border-slate-300 text-sky-700 focus:ring-sky-700"
            />
            Show MEP
          </label>
          <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            Round 1
          </span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-colors"
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
            fill="#ffffff"
            stroke={INK}
            strokeWidth="1.2"
          />
        ))}

        {plan.wallCabinets.map((cabinet, index) => {
          const inset = 2.5;
          return (
            <g key={`wall-${index}`}>
              <rect
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

        {plan.wallCorners?.map((corner, index) => (
          <WallCorner key={`wallcorner-${index}`} corner={corner} />
        ))}

        {plan.appliances.map((appliance) => (
          <Appliance 
            key={appliance.key} 
            appliance={appliance} 
            onPointerDown={handlePointerDown} 
            dragging={dragInfo?.id === appliance.key} 
          />
        ))}

        <Openings 
          plan={plan} 
          onPointerDown={handlePointerDown} 
          draggingId={dragInfo?.id} 
        />

        {showMep && plan.markers.map((marker, index) => (
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
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1.2"
      />
    </g>
  );
}

function WallCorner({ corner }: { corner: WallCornerShape }) {
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

function Appliance({ appliance, onPointerDown, dragging }: { appliance: ApplianceShape, onPointerDown: any, dragging?: boolean }) {
  const cx = appliance.x + appliance.w / 2;
  const cy = appliance.y + appliance.h / 2;
  const isHorizontal = appliance.wall === "TOP" || appliance.wall === "BOTTOM";
  const currentVal = isHorizontal ? appliance.x : appliance.y;
  return (
    <g
      onPointerDown={(e) => onPointerDown(appliance.key, appliance.wall, currentVal, e)}
      style={{ cursor: isHorizontal ? "ew-resize" : "ns-resize" }}
      className={`transition-opacity duration-100 ${dragging ? "opacity-60" : "hover:opacity-80"}`}
    >
      <rect
        x={appliance.x}
        y={appliance.y}
        width={appliance.w}
        height={appliance.h}
        rx="2"
        fill={appliance.symbol === "dishwasher" ? "transparent" : "#ffffff"}
        stroke={appliance.symbol === "dishwasher" ? "none" : INK}
        strokeWidth="1.3"
      />
      <ApplianceSymbol appliance={appliance} />
      {appliance.symbol !== "range" && appliance.symbol !== "sink" && appliance.symbol !== "hood" && appliance.symbol !== "dishwasher" && appliance.symbol !== "fridge" && appliance.label && (
        <text
          x={cx}
          y={cy + appliance.h / 2 - 6}
          textAnchor="middle"
          className="fill-slate-900 text-[11px] font-bold"
        >
          {appliance.label}
        </text>
      )}
    </g>
  );
}

function ApplianceSymbol({ appliance }: { appliance: ApplianceShape }) {
  const { x, y, w, h, symbol, wall } = appliance;
  const cx = x + w / 2;
  const cy = y + h * 0.4;
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
      nx = 1; ny = 0; tx = 0; ty = 1; cbx = x; cby = cy; len = h; dep = w;
    } else if (wall === "RIGHT") {
      nx = -1; ny = 0; tx = 0; ty = -1; cbx = x + w; cby = cy; len = h; dep = w;
    }

    const pt = (l: number, d: number) => [cbx + tx * l + nx * d, cby + ty * l + ny * d];
    
    const handleW = len * 0.55; 
    const handleD = dep * 0.08; 
    const handleY = dep; 
    
    const hTL = pt(-handleW / 2, handleY);
    const hBR = pt(handleW / 2, handleY + handleD);

    return (
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
      nx = 1; ny = 0; tx = 0; ty = 1; cbx = x; cby = cy; len = h; dep = w;
    } else if (wall === "RIGHT") {
      nx = -1; ny = 0; tx = 0; ty = -1; cbx = x + w; cby = cy; len = h; dep = w;
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
      nx = 1; ny = 0; tx = 0; ty = 1; cbx = x; cby = cy; len = h; dep = w;
    } else if (wall === "RIGHT") {
      nx = -1; ny = 0; tx = 0; ty = -1; cbx = x + w; cby = cy; len = h; dep = w;
    }

    const pt = (l: number, d: number) => [cbx + tx * l + nx * d, cby + ty * l + ny * d];
    
    const doorD = dep * 0.18;
    const gap = 1;
    
    const dl_pts = [pt(-len/2, dep - doorD), pt(-gap, dep - doorD), pt(-gap, dep), pt(-len/2, dep)];
    const dr_pts = [pt(gap, dep - doorD), pt(len/2, dep - doorD), pt(len/2, dep), pt(gap, dep)];
    
    const h1_0 = pt(-len * 0.1, dep - doorD * 0.3);
    const h1_1 = pt(-len * 0.1, dep + dep * 0.05);
    const h2_0 = pt(len * 0.1, dep - doorD * 0.3);
    const h2_1 = pt(len * 0.1, dep + dep * 0.05);

    const back_line_1 = pt(-len/2, dep * 0.12);
    const back_line_2 = pt(len/2, dep * 0.12);

    return (
      <g>
        <line x1={back_line_1[0]} y1={back_line_1[1]} x2={back_line_2[0]} y2={back_line_2[1]} stroke={LINE} strokeWidth="1" />
        <path d={`M ${dl_pts.map(p => p.join(",")).join(" L ")} Z`} fill="#e2e8f0" stroke={INK} strokeWidth="1.2" />
        <path d={`M ${dr_pts.map(p => p.join(",")).join(" L ")} Z`} fill="#e2e8f0" stroke={INK} strokeWidth="1.2" />
        <line x1={h1_0[0]} y1={h1_0[1]} x2={h1_1[0]} y2={h1_1[1]} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={h2_0[0]} y1={h2_0[1]} x2={h2_1[0]} y2={h2_1[1]} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }
  if (symbol === "oven") {
    return (
      <g fill="none" stroke={LINE} strokeWidth="1">
        <line x1={x + 5} y1={y + h * 0.35} x2={x + w - 5} y2={y + h * 0.35} />
        <line x1={x + 5} y1={y + h * 0.6} x2={x + w - 5} y2={y + h * 0.6} />
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

function Openings({ plan, onPointerDown, draggingId }: { plan: FloorPlan, onPointerDown: any, draggingId?: string }) {
  return (
    <g>
      {plan.window && (
        <g
          onPointerDown={(e) => onPointerDown("window", plan.window!.wall, plan.window!.wall === "TOP" || plan.window!.wall === "BOTTOM" ? plan.window!.x : plan.window!.y, e)}
          style={{ cursor: (plan.window!.wall === "TOP" || plan.window!.wall === "BOTTOM") ? "ew-resize" : "ns-resize" }}
          className={`transition-opacity duration-100 ${draggingId === "window" ? "opacity-60" : "hover:opacity-80"}`}
        >
          <rect
            x={plan.window.x}
            y={plan.window.y}
            width={plan.window.w}
            height={plan.window.h}
            fill="#ffffff"
          />
          {plan.window.wall === "TOP" || plan.window.wall === "BOTTOM" ? (
            <g>
              <line x1={plan.window.x} y1={plan.window.y} x2={plan.window.x + plan.window.w} y2={plan.window.y} stroke="#1e3a8a" strokeWidth="1.2" />
              <line x1={plan.window.x} y1={plan.window.y + plan.window.h / 2} x2={plan.window.x + plan.window.w} y2={plan.window.y + plan.window.h / 2} stroke="#1e3a8a" strokeWidth="1.2" />
              <line x1={plan.window.x} y1={plan.window.y + plan.window.h} x2={plan.window.x + plan.window.w} y2={plan.window.y + plan.window.h} stroke="#1e3a8a" strokeWidth="1.2" />
            </g>
          ) : (
            <g>
              <line x1={plan.window.x} y1={plan.window.y} x2={plan.window.x} y2={plan.window.y + plan.window.h} stroke="#1e3a8a" strokeWidth="1.2" />
              <line x1={plan.window.x + plan.window.w / 2} y1={plan.window.y} x2={plan.window.x + plan.window.w / 2} y2={plan.window.y + plan.window.h} stroke="#1e3a8a" strokeWidth="1.2" />
              <line x1={plan.window.x + plan.window.w} y1={plan.window.y} x2={plan.window.x + plan.window.w} y2={plan.window.y + plan.window.h} stroke="#1e3a8a" strokeWidth="1.2" />
            </g>
          )}
          <text
            x={plan.window.wall === "LEFT" ? plan.window.x - 6 : (plan.window.wall === "RIGHT" ? plan.window.x + plan.window.w + 6 : plan.window.x + plan.window.w / 2)}
            y={plan.window.wall === "TOP" ? plan.window.y - 5 : (plan.window.wall === "BOTTOM" ? plan.window.y + plan.window.h + 12 : plan.window.y + plan.window.h / 2)}
            textAnchor={plan.window.wall === "LEFT" ? "end" : (plan.window.wall === "RIGHT" ? "start" : "middle")}
            dominantBaseline={plan.window.wall === "LEFT" || plan.window.wall === "RIGHT" ? "middle" : "auto"}
            className="fill-slate-500 text-[11px] font-bold"
          >
            window
          </text>
        </g>
      )}
      {plan.door && (
        <g
          onPointerDown={(e) => onPointerDown("door", plan.door!.wall, plan.door!.wall === "TOP" || plan.door!.wall === "BOTTOM" ? plan.door!.cx : plan.door!.cy, e)}
          style={{ cursor: (plan.door!.wall === "TOP" || plan.door!.wall === "BOTTOM") ? "ew-resize" : "ns-resize" }}
          className={`transition-opacity duration-100 ${draggingId === "door" ? "opacity-60" : "hover:opacity-80"}`}
        >
          <rect
            x={plan.door.breakRect.x}
            y={plan.door.breakRect.y}
            width={plan.door.breakRect.w}
            height={plan.door.breakRect.h}
            fill="#ffffff"
          />
          <rect
            x={plan.door.leafRect.x}
            y={plan.door.leafRect.y}
            width={plan.door.leafRect.w}
            height={plan.door.leafRect.h}
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.5"
          />
          <path d={plan.door.swingPath} fill="none" stroke="#2563eb" strokeWidth="1.2" />
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
  return null;
}

function Stamp({ plan }: { plan: FloorPlan }) {
  return null;
}
