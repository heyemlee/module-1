import type { ReactNode } from "react";
import type { DrawingSheetId, WallId } from "../round2-types";

const COLORS = {
  ink: "#151515",
  dimension: "#079ca5",
  cabinet: "#f28c28",
  number: "#e12821",
  opening: "#1478ff",
  muted: "#696969"
} as const;

type DrawingSheetProps = {
  sheet: Exclude<DrawingSheetId, "S1">;
  measurementVersion: number;
  proposalVersion: number;
};

export function DrawingSheet({
  sheet,
  measurementVersion,
  proposalVersion
}: DrawingSheetProps) {
  const title =
    sheet === "A1"
      ? "MEASURED FLOOR PLAN"
      : `WALL ${wallForSheet(sheet)} ELEVATION`;

  return (
    <svg
      viewBox="0 0 1000 720"
      role="img"
      aria-label={`${sheet} ${title}`}
      className="block h-auto w-full bg-white"
    >
      <rect x="16" y="16" width="968" height="688" fill="#fff" stroke={COLORS.ink} strokeWidth="2" />
      <rect x="30" y="30" width="940" height="660" fill="none" stroke={COLORS.ink} strokeWidth="1" />

      {sheet === "A1" ? <PlanSheet /> : <ElevationSheet wall={wallForSheet(sheet)} />}

      <g fontFamily="var(--studio-mono)" fill={COLORS.ink}>
        <line x1="30" y1="648" x2="970" y2="648" stroke={COLORS.ink} />
        <line x1="690" y1="648" x2="690" y2="690" stroke={COLORS.ink} />
        <line x1="842" y1="648" x2="842" y2="690" stroke={COLORS.ink} />
        <text x="48" y="669" fontSize="16" fontWeight="700">{sheet} · {title}</text>
        <text x="48" y="684" fontSize="9" fill={COLORS.muted}>MIKE · MAIN KITCHEN · ROUND 2 VISUAL PROTOTYPE</text>
        <text x="704" y="665" fontSize="9">MEASUREMENT v{measurementVersion}</text>
        <text x="704" y="681" fontSize="9">PROPOSAL v{proposalVersion}</text>
        <text x="858" y="665" fontSize="9">SCALE</text>
        <text x="858" y="682" fontSize="12" fontWeight="700">{sheet === "A1" ? "1:50" : "1:30"}</text>
      </g>
    </svg>
  );
}

function wallForSheet(sheet: "A2" | "A3" | "A4"): WallId {
  if (sheet === "A2") return "A";
  if (sheet === "A3") return "B";
  return "C";
}

function PlanSheet() {
  const upper = [
    { x: 300, width: 88, code: "#1", label: "30″" },
    { x: 388, width: 74, code: "#2", label: "27″" },
    { x: 462, width: 112, code: "#3", label: "36″" },
    { x: 574, width: 76, code: "#4", label: "24″" }
  ] as const;
  const lower = [
    { x: 310, width: 88, code: "#10", label: "30″" },
    { x: 398, width: 78, code: "#11", label: "27″" },
    { x: 476, width: 58, code: "#12", label: "18″" },
    { x: 534, width: 108, code: "#13", label: "36″" },
    { x: 642, width: 76, code: "#14", label: "24″" }
  ] as const;

  return (
    <g>
      <g data-drawing-layer="structure" stroke={COLORS.ink} fill="none">
        <rect x="96" y="70" width="808" height="520" strokeWidth="2.5" />
        <rect x="120" y="92" width="760" height="476" strokeWidth="1.4" />
        <path d="M 120 216 H 96 M 120 390 H 96" stroke={COLORS.opening} strokeWidth="3" />
        <path d="M 452 92 H 548" stroke={COLORS.opening} strokeWidth="4" />
        <path d="M 880 232 V 302 M 880 302 H 938" stroke={COLORS.opening} strokeWidth="2.5" />
        <path d="M 880 302 A 58 58 0 0 0 938 244" stroke={COLORS.opening} strokeWidth="1.8" />
      </g>

      <g data-drawing-layer="cabinet-boundaries" stroke={COLORS.cabinet} fill="none" strokeWidth="2">
        {upper.map((cabinet) => (
          <rect key={cabinet.code} x={cabinet.x} y="195" width={cabinet.width} height="74" />
        ))}
        {lower.map((cabinet) => (
          <rect key={cabinet.code} x={cabinet.x} y="390" width={cabinet.width} height="74" />
        ))}
      </g>

      <g stroke={COLORS.ink} fill="#fff" strokeWidth="1.4">
        {upper.map((cabinet) => (
          <rect key={cabinet.code} x={cabinet.x + 4} y="199" width={cabinet.width - 8} height="66" />
        ))}
        {lower.map((cabinet) => (
          <rect key={cabinet.code} x={cabinet.x + 4} y="394" width={cabinet.width - 8} height="66" />
        ))}
        <rect x="485" y="204" width="64" height="56" fill="#f4fbfb" stroke={COLORS.dimension} />
        <ellipse cx="517" cy="232" rx="22" ry="16" stroke={COLORS.dimension} />
        <rect x="652" y="399" width="60" height="56" fill="#f5f5f5" />
        <circle cx="682" cy="427" r="18" />
      </g>

      <g data-drawing-layer="cabinet-numbers" fill={COLORS.number} fontFamily="var(--studio-mono)" fontSize="16" textAnchor="middle">
        {upper.map((cabinet) => (
          <text key={cabinet.code} x={cabinet.x + cabinet.width / 2} y="241">{cabinet.code}</text>
        ))}
        {lower.map((cabinet) => (
          <text key={cabinet.code} x={cabinet.x + cabinet.width / 2} y="437">{cabinet.code}</text>
        ))}
      </g>

      <g data-drawing-layer="dimensions" stroke={COLORS.dimension} fill={COLORS.dimension} fontFamily="var(--studio-mono)" fontSize="10">
        <Dimension x1={286} x2={664} y={154} label="164″" />
        <Dimension x1={300} x2={650} y={176} label="3/4″ · 30″ · 27″ · 18″ · 36″ · 24″" />
        <Dimension x1={310} x2={718} y={492} label="3/4″ · 30″ · 27″ · 18″ · 36″ · 24″" />
        <Dimension x1={300} x2={718} y={515} label="154 1/2″" />
        <Dimension x1={290} x2={728} y={346} label="150 3/8″" />
        <DimensionVertical x={752} y1={195} y2={269} label="24″" />
        <DimensionVertical x={752} y1={390} y2={464} label="24″" />
      </g>

      <g fontFamily="var(--studio-mono)" fill={COLORS.muted} fontSize="9">
        <text x="500" y="615" textAnchor="middle">A1 FLOOR PLAN · CABINET LAYOUT AND DIMENSION CONTROL</text>
        <text x="834" y="219" fill={COLORS.opening}>DOOR</text>
        <text x="500" y="82" textAnchor="middle" fill={COLORS.opening}>WINDOW</text>
      </g>
    </g>
  );
}

function ElevationSheet({ wall }: { wall: WallId }) {
  const specs = elevationSpecs(wall);
  return (
    <g>
      <g data-drawing-layer="structure" stroke={COLORS.ink} fill="none">
        <line x1="90" y1="562" x2="910" y2="562" strokeWidth="2" />
        <line x1="110" y1="120" x2="110" y2="562" strokeWidth="2" />
        <line x1="890" y1="120" x2="890" y2="562" strokeWidth="2" />
        {wall === "A" && (
          <g stroke={COLORS.opening}>
            <rect x="414" y="210" width="172" height="182" strokeWidth="2" />
            <line x1="500" y1="210" x2="500" y2="392" />
            <line x1="414" y1="301" x2="586" y2="301" />
          </g>
        )}
      </g>

      <g data-drawing-layer="cabinet-boundaries" stroke={COLORS.cabinet} fill="none" strokeWidth="2">
        {specs.map((cabinet) => (
          <rect
            key={cabinet.code}
            x={cabinet.x}
            y={cabinet.y}
            width={cabinet.width}
            height={cabinet.height}
          />
        ))}
      </g>

      <g stroke={COLORS.ink} fill="#fff" strokeWidth="1.25">
        {specs.map((cabinet) => (
          <CabinetFace key={cabinet.code} {...cabinet} />
        ))}
      </g>

      <g data-drawing-layer="cabinet-numbers" fill={COLORS.number} fontFamily="var(--studio-mono)" fontSize="19" textAnchor="middle">
        {specs.map((cabinet) => (
          <text
            key={cabinet.code}
            x={cabinet.x + cabinet.width / 2}
            y={cabinet.y + cabinet.height / 2 + 6}
          >
            {cabinet.code}
          </text>
        ))}
      </g>

      <g data-drawing-layer="dimensions" stroke={COLORS.dimension} fill={COLORS.dimension} fontFamily="var(--studio-mono)" fontSize="10">
        <Dimension x1={110} x2={890} y={82} label={wall === "A" ? "164″" : "150 3/8″"} />
        <Dimension x1={132} x2={868} y={103} label="24″ · 3/4″ · 30″ · 15″ · 42″ · 15″ · 30″ · 1 1/2″" />
        <Dimension x1={132} x2={868} y={596} label="3/4″ · 30″ · 27″ · 18″ · 36″ · 24″ · 1 1/2″" />
        <DimensionVertical x={932} y1={120} y2={562} label="95 13/16″" />
        <DimensionVertical x={910} y1={390} y2={562} label="34 1/2″" />
        <DimensionVertical x={910} y1={210} y2={390} label="36″" />
      </g>

      <g fontFamily="var(--studio-mono)" fill={COLORS.muted} fontSize="9">
        <text x="500" y="622" textAnchor="middle">WALL {wall} ELEVATION · CABINET IDENTIFICATION AND CONTROL DIMENSIONS</text>
      </g>
    </g>
  );
}

type ElevationCabinet = {
  x: number;
  y: number;
  width: number;
  height: number;
  code: string;
  door: "single" | "double" | "drawer";
};

function elevationSpecs(wall: WallId): readonly ElevationCabinet[] {
  if (wall === "A") {
    return [
      { x: 132, y: 178, width: 112, height: 116, code: "#1", door: "double" },
      { x: 244, y: 178, width: 94, height: 116, code: "#2", door: "double" },
      { x: 662, y: 178, width: 94, height: 116, code: "#3", door: "double" },
      { x: 756, y: 178, width: 112, height: 116, code: "#4", door: "double" },
      { x: 132, y: 390, width: 118, height: 172, code: "#10", door: "drawer" },
      { x: 250, y: 390, width: 108, height: 172, code: "#11", door: "drawer" },
      { x: 358, y: 390, width: 76, height: 172, code: "#12", door: "single" },
      { x: 434, y: 390, width: 152, height: 172, code: "#13", door: "double" },
      { x: 662, y: 390, width: 112, height: 172, code: "#14", door: "double" }
    ];
  }
  if (wall === "B") {
    return [
      { x: 140, y: 188, width: 126, height: 116, code: "#5", door: "double" },
      { x: 266, y: 188, width: 52, height: 116, code: "#6", door: "single" },
      { x: 318, y: 188, width: 154, height: 116, code: "#7", door: "double" },
      { x: 548, y: 188, width: 132, height: 116, code: "#8", door: "double" },
      { x: 680, y: 188, width: 172, height: 116, code: "#9", door: "double" },
      { x: 140, y: 404, width: 126, height: 158, code: "#15", door: "double" },
      { x: 266, y: 404, width: 52, height: 158, code: "#16", door: "single" },
      { x: 548, y: 404, width: 132, height: 158, code: "#17", door: "double" }
    ];
  }
  return [
    { x: 146, y: 178, width: 124, height: 116, code: "#18", door: "double" },
    { x: 270, y: 178, width: 126, height: 116, code: "#19", door: "double" },
    { x: 396, y: 178, width: 156, height: 116, code: "#20", door: "double" },
    { x: 552, y: 178, width: 132, height: 116, code: "#21", door: "double" },
    { x: 684, y: 178, width: 170, height: 116, code: "#22", door: "double" },
    { x: 146, y: 390, width: 124, height: 172, code: "#23", door: "drawer" },
    { x: 270, y: 390, width: 126, height: 172, code: "#24", door: "double" },
    { x: 552, y: 390, width: 132, height: 172, code: "#25", door: "drawer" },
    { x: 684, y: 390, width: 170, height: 172, code: "#26", door: "double" }
  ];
}

function CabinetFace({
  x,
  y,
  width,
  height,
  door
}: ElevationCabinet) {
  if (door === "drawer") {
    return (
      <g>
        <rect x={x + 3} y={y + 3} width={width - 6} height={height - 6} />
        <line x1={x + 3} y1={y + height / 3} x2={x + width - 3} y2={y + height / 3} />
        <line x1={x + 3} y1={y + (height * 2) / 3} x2={x + width - 3} y2={y + (height * 2) / 3} />
      </g>
    );
  }
  return (
    <g>
      <rect x={x + 3} y={y + 3} width={width - 6} height={height - 6} />
      {door === "double" && (
        <>
          <line x1={x + width / 2} y1={y + 3} x2={x + width / 2} y2={y + height - 3} />
          <path d={`M ${x + 3} ${y + 3} L ${x + width / 2} ${y + height / 2} L ${x + 3} ${y + height - 3}`} stroke={COLORS.number} fill="none" />
          <path d={`M ${x + width - 3} ${y + 3} L ${x + width / 2} ${y + height / 2} L ${x + width - 3} ${y + height - 3}`} stroke={COLORS.number} fill="none" />
        </>
      )}
    </g>
  );
}

function Dimension({
  x1,
  x2,
  y,
  label
}: {
  x1: number;
  x2: number;
  y: number;
  label: ReactNode;
}) {
  return (
    <g>
      <line x1={x1} y1={y - 6} x2={x1} y2={y + 6} />
      <line x1={x2} y1={y - 6} x2={x2} y2={y + 6} />
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" stroke="none">{label}</text>
    </g>
  );
}

function DimensionVertical({
  x,
  y1,
  y2,
  label
}: {
  x: number;
  y1: number;
  y2: number;
  label: ReactNode;
}) {
  return (
    <g>
      <line x1={x - 6} y1={y1} x2={x + 6} y2={y1} />
      <line x1={x - 6} y1={y2} x2={x + 6} y2={y2} />
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <text
        x={x + 14}
        y={(y1 + y2) / 2}
        textAnchor="middle"
        stroke="none"
        transform={`rotate(90 ${x + 14} ${(y1 + y2) / 2})`}
      >
        {label}
      </text>
    </g>
  );
}
