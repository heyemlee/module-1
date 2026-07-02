import type { ReactNode } from "react";
import {
  formatSixteenths,
  findWall,
  type Round2Model,
  type Round2Wall,
  type WallId,
  type WallSegment
} from "../model/round2-model";
import type { DrawingSheetId } from "../round2-types";

const COLORS = {
  ink: "#151515",
  dimension: "#079ca5",
  cabinet: "#f28c28",
  filler: "#c89615",
  number: "#e12821",
  opening: "#1478ff",
  muted: "#696969"
} as const;

const PLAN = { left: 170, top: 128, right: 830, bottom: 540 };

export type DrawingSheetDefinition = {
  id: DrawingSheetId;
  label: string;
  wallId?: WallId;
};

type DrawingSheetProps = {
  sheet: DrawingSheetDefinition;
  model: Round2Model | null;
  measurementVersion: number;
  proposalVersion: number;
  customerName: string;
  projectName: string;
};

export function drawingSheetsForModel(
  model: Round2Model | null
): DrawingSheetDefinition[] {
  const elevationSheets =
    model?.walls.map((wall, index) => ({
      id: `A${index + 2}`,
      label: `Wall ${wall.label} elevation`,
      wallId: wall.id
    })) ?? [];

  return [
    { id: "A1", label: "Measured floor plan" },
    ...elevationSheets,
    { id: "S1", label: "Cabinet schedule" }
  ];
}

export function DrawingSheet({
  sheet,
  model,
  measurementVersion,
  proposalVersion,
  customerName,
  projectName
}: DrawingSheetProps) {
  const wall = sheet.wallId ? findWall(model, sheet.wallId) : null;
  const title =
    sheet.id === "A1"
      ? "MEASURED FLOOR PLAN"
      : wall
        ? `WALL ${wall.label} ELEVATION`
        : "WALL ELEVATION";

  return (
    <svg
      viewBox="0 0 1000 720"
      role="img"
      aria-label={`${sheet.id} ${title}`}
      className="block h-auto w-full bg-white"
    >
      <rect x="16" y="16" width="968" height="688" fill="#fff" stroke={COLORS.ink} strokeWidth="2" />
      <rect x="30" y="30" width="940" height="660" fill="none" stroke={COLORS.ink} strokeWidth="1" />

      {sheet.id === "A1" ? (
        <PlanSheet model={model} />
      ) : (
        <ElevationSheet wall={wall} model={model} />
      )}

      <TitleBlock
        sheetId={sheet.id}
        title={title}
        measurementVersion={measurementVersion}
        proposalVersion={proposalVersion}
        customerName={customerName}
        projectName={projectName}
        scale={sheet.id === "A1" ? "1:50" : "1:30"}
      />
    </svg>
  );
}

function PlanSheet({ model }: { model: Round2Model | null }) {
  const walls = model?.walls ?? [];
  return (
    <g>
      <g data-drawing-layer="structure" stroke={COLORS.ink} fill="none">
        {walls.length === 0 ? (
          <rect x="120" y="92" width="760" height="476" strokeWidth="1.6" strokeDasharray="10 8" />
        ) : (
          walls.map((wall) => {
            const line = planWallLine(wall);
            return (
              <line
                key={wall.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                strokeWidth="8"
              />
            );
          })
        )}
      </g>

      <g data-drawing-layer="cabinet-boundaries" stroke={COLORS.cabinet} fill="none" strokeWidth="2">
        {walls.map((wall) => (
          <PlanRun key={wall.id} wall={wall} />
        ))}
      </g>

      <g data-drawing-layer="openings" stroke={COLORS.opening} fill={COLORS.opening}>
        {walls.flatMap((wall) =>
          wall.fixedPoints
            .filter((point) => point.type === "window" || point.type === "door")
            .map((point) => {
              const line = planWallLine(wall);
              const startRatio =
                wall.lengthSixteenths && point.offsetSixteenths != null
                  ? point.offsetSixteenths / wall.lengthSixteenths
                  : point.positionRatio;
              const widthRatio =
                wall.lengthSixteenths && point.widthSixteenths
                  ? point.widthSixteenths / wall.lengthSixteenths
                  : 0.15;
              const start = pointOnLine(line, clamp01(startRatio));
              const end = pointOnLine(line, clamp01(startRatio + widthRatio));
              return (
                <g key={point.id}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    strokeWidth="5"
                  />
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 - 14}
                    textAnchor="middle"
                    fontFamily="var(--studio-mono)"
                    fontSize="9"
                    stroke="none"
                  >
                    {point.label.toUpperCase()}
                  </text>
                </g>
              );
            })
        )}
      </g>

      <g data-drawing-layer="dimensions" stroke={COLORS.dimension} fill={COLORS.dimension} fontFamily="var(--studio-mono)" fontSize="10">
        {walls.map((wall) => (
          <PlanWallDimensions key={wall.id} wall={wall} />
        ))}
      </g>

      <g fontFamily="var(--studio-mono)" fill={COLORS.muted} fontSize="9">
        <text x="500" y="615" textAnchor="middle">
          A1 FLOOR PLAN · CABINET LAYOUT AND DIMENSION CONTROL
        </text>
      </g>
    </g>
  );
}

function PlanRun({ wall }: { wall: Round2Wall }) {
  const segments = wall.segments.filter(
    (segment) => segment.tier === "base" || segment.tier === "full"
  );
  if (segments.length === 0) return null;

  const total = wall.lengthSixteenths ?? 1;
  const available = planWallLength(wall);
  let cursor = 0;

  return (
    <g>
      {segments.map((segment) => {
        const safeWidth = Math.max(0, segment.widthSixteenths);
        const length = (safeWidth / total) * available;
        const rect = planSegmentRect(wall, cursor, length);
        cursor += length;
        return (
          <g key={segment.id}>
            <rect
              x={rect.x}
              y={rect.y}
              width={Math.max(2, rect.width)}
              height={Math.max(2, rect.height)}
              fill={segment.kind === "filler" ? "#fff7d8" : "#fff"}
              stroke={segment.kind === "filler" ? COLORS.filler : COLORS.cabinet}
            />
            <g data-drawing-layer="cabinet-numbers">
              <text
                x={rect.x + rect.width / 2}
                y={rect.y + rect.height / 2 + 4}
                textAnchor="middle"
                fontFamily="var(--studio-mono)"
                fontSize="10"
                fill={segment.kind === "filler" ? COLORS.filler : COLORS.number}
                stroke="none"
                transform={rect.rotate}
              >
                {segment.code ?? segment.label}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

function PlanWallDimensions({ wall }: { wall: Round2Wall }) {
  const line = dimensionLineForWall(wall);
  const chain = wall.segments
    .filter((segment) => segment.tier === "base")
    .map((segment) => formatSixteenths(segment.widthSixteenths))
    .join(" · ");

  if (wall.sourceWall === "TOP" || wall.sourceWall === "BOTTOM") {
    return (
      <g>
        <Dimension x1={line.x1} x2={line.x2} y={line.y1} label={formatSixteenths(wall.lengthSixteenths)} />
        {chain && (
          <Dimension x1={line.x1 + 20} x2={line.x2 - 20} y={line.y1 + (wall.sourceWall === "TOP" ? 22 : -22)} label={chain} />
        )}
      </g>
    );
  }

  return (
    <g>
      <DimensionVertical x={line.x1} y1={line.y1} y2={line.y2} label={formatSixteenths(wall.lengthSixteenths)} />
      {chain && (
        <text
          x={line.x1 + (wall.sourceWall === "RIGHT" ? 28 : -28)}
          y={(line.y1 + line.y2) / 2}
          textAnchor="middle"
          transform={`rotate(${wall.sourceWall === "RIGHT" ? 90 : -90} ${line.x1 + (wall.sourceWall === "RIGHT" ? 28 : -28)} ${(line.y1 + line.y2) / 2})`}
          stroke="none"
        >
          {chain}
        </text>
      )}
    </g>
  );
}

function ElevationSheet({
  wall,
  model
}: {
  wall: Round2Wall | null;
  model: Round2Model | null;
}) {
  const segments = wall?.segments ?? [];
  const upper = segments.filter((segment) => segment.tier === "upper");
  const base = segments.filter((segment) => segment.tier === "base");
  const total = wall?.lengthSixteenths ?? 1;

  return (
    <g>
      <g data-drawing-layer="structure" stroke={COLORS.ink} fill="none">
        <line x1="90" y1="562" x2="910" y2="562" strokeWidth="2" />
        <line x1="110" y1="120" x2="110" y2="562" strokeWidth="2" />
        <line x1="890" y1="120" x2="890" y2="562" strokeWidth="2" />
        {wall?.fixedPoints
          .filter((point) => point.type === "window" || point.type === "door")
          .map((point) => {
            const width =
              wall.lengthSixteenths && point.widthSixteenths
                ? (point.widthSixteenths / wall.lengthSixteenths) * 780
                : 120;
            const x =
              110 +
              ((point.offsetSixteenths ??
                Math.round(point.positionRatio * (wall.lengthSixteenths ?? 1))) /
                (wall.lengthSixteenths ?? 1)) *
                780;
            return (
              <g key={point.id} stroke={COLORS.opening}>
                <rect x={x} y="210" width={width} height="150" strokeWidth="2" />
                <line x1={x + width / 2} y1="210" x2={x + width / 2} y2="360" />
                <line x1={x} y1="285" x2={x + width} y2="285" />
              </g>
            );
          })}
      </g>

      <g data-drawing-layer="cabinet-boundaries" stroke={COLORS.cabinet} fill="none" strokeWidth="2">
        <ElevationRun segments={upper} total={total} />
        <ElevationRun segments={base} total={total} />
      </g>

      <g data-drawing-layer="cabinet-numbers" fill={COLORS.number} fontFamily="var(--studio-mono)" fontSize="18" textAnchor="middle">
        {[...elevationPlacements(upper, total), ...elevationPlacements(base, total)].map(({ segment, x, width }) => (
          <text
            key={segment.id}
            data-segment-id={segment.id}
            x={x + width / 2}
            y={elevationBox(segment).y + elevationBox(segment).height / 2 + 6}
            fill={segment.kind === "filler" ? COLORS.filler : COLORS.number}
          >
            {segment.code ?? segment.label}
          </text>
        ))}
      </g>

      <g data-drawing-layer="dimensions" stroke={COLORS.dimension} fill={COLORS.dimension} fontFamily="var(--studio-mono)" fontSize="10">
        <Dimension x1={110} x2={890} y={82} label={formatSixteenths(wall?.lengthSixteenths)} />
        {upper.length > 0 && <Dimension x1={130} x2={870} y={103} label={segmentChain(upper)} />}
        {base.length > 0 && <Dimension x1={130} x2={870} y={596} label={segmentChain(base)} />}
        <DimensionVertical x={932} y1={120} y2={562} label={formatSixteenths(model?.ceilingHeightSixteenths)} />
        <DimensionVertical x={910} y1={390} y2={562} label="34 1/2″" />
        <DimensionVertical x={910} y1={210} y2={390} label="36″" />
      </g>

      <g fontFamily="var(--studio-mono)" fill={COLORS.muted} fontSize="9">
        <text x="500" y="622" textAnchor="middle">
          WALL {wall?.label ?? "?"} ELEVATION · CABINET IDENTIFICATION AND CONTROL DIMENSIONS
        </text>
      </g>
    </g>
  );
}

function ElevationRun({
  segments,
  total
}: {
  segments: WallSegment[];
  total: number;
}) {
  return (
    <g>
      {elevationPlacements(segments, total).map(({ segment, x, width }) => {
        const { y, height } = elevationBox(segment);
        return (
          <g key={segment.id}>
            <rect
              x={x}
              y={y}
              width={Math.max(2, width)}
              height={height}
              fill={segment.kind === "filler" ? "#fff7d8" : "#fff"}
              stroke={segment.kind === "filler" ? COLORS.filler : COLORS.cabinet}
            />
            {segment.kind !== "filler" && segment.kind !== "opening" && (
              <CabinetFace x={x} y={y} width={Math.max(2, width)} height={height} />
            )}
          </g>
        );
      })}
    </g>
  );
}

function CabinetFace({
  x,
  y,
  width,
  height
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <g stroke={COLORS.ink} fill="none" strokeWidth="1.1">
      <rect x={x + 3} y={y + 3} width={Math.max(1, width - 6)} height={height - 6} />
      {width > 34 && (
        <line x1={x + width / 2} y1={y + 3} x2={x + width / 2} y2={y + height - 3} />
      )}
      <path d={`M ${x + 3} ${y + 3} L ${x + width / 2} ${y + height / 2} L ${x + 3} ${y + height - 3}`} stroke={COLORS.number} />
      <path d={`M ${x + width - 3} ${y + 3} L ${x + width / 2} ${y + height / 2} L ${x + width - 3} ${y + height - 3}`} stroke={COLORS.number} />
    </g>
  );
}

function TitleBlock({
  sheetId,
  title,
  measurementVersion,
  proposalVersion,
  customerName,
  projectName,
  scale
}: {
  sheetId: string;
  title: string;
  measurementVersion: number;
  proposalVersion: number;
  customerName: string;
  projectName: string;
  scale: string;
}) {
  return (
    <g fontFamily="var(--studio-mono)" fill={COLORS.ink}>
      <line x1="30" y1="648" x2="970" y2="648" stroke={COLORS.ink} />
      <line x1="690" y1="648" x2="690" y2="690" stroke={COLORS.ink} />
      <line x1="842" y1="648" x2="842" y2="690" stroke={COLORS.ink} />
      <text x="48" y="669" fontSize="16" fontWeight="700">{sheetId} · {title}</text>
      <text x="48" y="684" fontSize="9" fill={COLORS.muted}>
        {customerName.toUpperCase()} · {projectName.toUpperCase()} · ROUND 2 VISUAL PROTOTYPE
      </text>
      <text x="704" y="665" fontSize="9">MEASUREMENT v{measurementVersion}</text>
      <text x="704" y="681" fontSize="9">PROPOSAL v{proposalVersion}</text>
      <text x="858" y="665" fontSize="9">SCALE</text>
      <text x="858" y="682" fontSize="12" fontWeight="700">{scale}</text>
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

function planWallLine(wall: Round2Wall) {
  if (wall.sourceWall === "TOP") {
    return { x1: PLAN.left, y1: PLAN.top, x2: PLAN.right, y2: PLAN.top };
  }
  if (wall.sourceWall === "RIGHT") {
    return { x1: PLAN.right, y1: PLAN.top, x2: PLAN.right, y2: PLAN.bottom };
  }
  if (wall.sourceWall === "BOTTOM") {
    return { x1: PLAN.right, y1: PLAN.bottom, x2: PLAN.left, y2: PLAN.bottom };
  }
  return { x1: PLAN.left, y1: PLAN.bottom, x2: PLAN.left, y2: PLAN.top };
}

function planWallLength(wall: Round2Wall): number {
  const line = planWallLine(wall);
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function pointOnLine(
  line: { x1: number; y1: number; x2: number; y2: number },
  ratio: number
) {
  return {
    x: line.x1 + (line.x2 - line.x1) * ratio,
    y: line.y1 + (line.y2 - line.y1) * ratio
  };
}

function planSegmentRect(wall: Round2Wall, cursor: number, length: number) {
  if (wall.sourceWall === "TOP") {
    return { x: PLAN.left + cursor, y: PLAN.top + 12, width: length, height: 46 };
  }
  if (wall.sourceWall === "RIGHT") {
    return {
      x: PLAN.right - 58,
      y: PLAN.top + cursor,
      width: 46,
      height: length,
      rotate: `rotate(90 ${PLAN.right - 35} ${PLAN.top + cursor + length / 2})`
    };
  }
  if (wall.sourceWall === "BOTTOM") {
    return { x: PLAN.right - cursor - length, y: PLAN.bottom - 58, width: length, height: 46 };
  }
  return {
    x: PLAN.left + 12,
    y: PLAN.bottom - cursor - length,
    width: 46,
    height: length,
    rotate: `rotate(-90 ${PLAN.left + 35} ${PLAN.bottom - cursor - length / 2})`
  };
}

function dimensionLineForWall(wall: Round2Wall) {
  if (wall.sourceWall === "TOP") {
    return { x1: PLAN.left, y1: 82, x2: PLAN.right, y2: 82 };
  }
  if (wall.sourceWall === "RIGHT") {
    return { x1: 880, y1: PLAN.top, x2: 880, y2: PLAN.bottom };
  }
  if (wall.sourceWall === "BOTTOM") {
    return { x1: PLAN.left, y1: 584, x2: PLAN.right, y2: 584 };
  }
  return { x1: 120, y1: PLAN.top, x2: 120, y2: PLAN.bottom };
}

function elevationBox(segment: WallSegment): { y: number; height: number } {
  if (segment.tier === "upper") return { y: 178, height: 116 };
  if (segment.cabinetKind === "tall") return { y: 178, height: 384 };
  return { y: 390, height: 172 };
}

function elevationPlacements(segments: WallSegment[], total: number) {
  let cursor = 0;
  return segments.map((segment) => {
    const width = (Math.max(0, segment.widthSixteenths) / total) * 780;
    const placement = { segment, x: 110 + cursor, width };
    cursor += width;
    return placement;
  });
}

function segmentChain(segments: WallSegment[]): string {
  return segments
    .map((segment) => formatSixteenths(segment.widthSixteenths))
    .join(" · ");
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
