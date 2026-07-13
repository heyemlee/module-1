import type { ReactNode } from "react";
import {
  formatSixteenths,
  findWall,
  type Round2HeightProfile,
  type Round2Model,
  type Round2Wall,
  type WallId,
  type WallSegment
} from "../model/round2-model";
import { CABINET_STANDARDS } from "../model/cabinet-standards";
import { assignDimensionLanes } from "../model/dimension-lanes";
import { resolveSegmentFront, type ResolvedFront } from "../model/front";
import {
  resolveSegmentRole,
  SEGMENT_ROLE_TAGS
} from "../model/segment-role";
import { ApplianceGlyph, WindowGlyph } from "../appliance-glyphs";
import type { Round2DesignIntent } from "../model/design-intent";
import {
  fridgeAboveHeightForSegment,
  isCappedFridge,
  isFridgeAboveUnit,
  resolveFridgeAboveHeights
} from "../model/fridge-surround";
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
  intent?: Round2DesignIntent;
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
  intent,
  measurementVersion,
  proposalVersion,
  customerName,
  projectName
}: DrawingSheetProps) {
  const wall = sheet.wallId ? findWall(model, sheet.wallId) : null;
  const showTitleBlock = sheet.id === "A1";
  const sheetHeight = showTitleBlock ? 720 : 650;
  const outerHeight = showTitleBlock ? 688 : 618;
  const innerHeight = showTitleBlock ? 660 : 590;
  const title =
    sheet.id === "A1"
      ? "MEASURED FLOOR PLAN"
      : wall
        ? `WALL ${wall.label} ELEVATION`
        : "WALL ELEVATION";

  return (
    <svg
      viewBox={`0 0 1000 ${sheetHeight}`}
      role="img"
      aria-label={`${sheet.id} ${title}`}
      className="block h-auto w-full bg-white"
    >
      <rect x="16" y="16" width="968" height={outerHeight} fill="#fff" stroke={COLORS.ink} strokeWidth="2" />
      <rect x="30" y="30" width="940" height={innerHeight} fill="none" stroke={COLORS.ink} strokeWidth="1" />

      {sheet.id === "A1" ? (
        <PlanSheet model={model} />
      ) : (
        <ElevationSheet wall={wall} model={model} intent={intent} />
      )}

      {showTitleBlock && (
        <TitleBlock
          sheetId={sheet.id}
          title={title}
          measurementVersion={measurementVersion}
          proposalVersion={proposalVersion}
          customerName={customerName}
          projectName={projectName}
          scale="1:50"
        />
      )}
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
              fill={
                segment.kind === "panel"
                  ? "#efe6f2"
                  : segment.kind === "filler"
                    ? "#fff7d8"
                    : "#fff"
              }
              stroke={segment.kind === "filler" ? COLORS.filler : COLORS.cabinet}
            />
            {/* Finished panels are too thin in plan to letter — the stroke
                and shade are enough; cabinets and fillers keep their number. */}
            {segment.kind !== "panel" && (
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
            )}
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
  model,
  intent
}: {
  wall: Round2Wall | null;
  model: Round2Model | null;
  intent?: Round2DesignIntent;
}) {
  const segments = wall?.segments ?? [];
  const upper = segments.filter((segment) => segment.tier === "upper");
  const base = segments.filter((segment) => segment.tier !== "upper");
  const total = wall?.lengthSixteenths ?? 1;
  const layout = sheetVerticalLayout(model);
  const mirrored = isMirroredElevationWall(wall);
  const fridgeAboveHeights = resolveFridgeAboveHeights(
    segments,
    intent,
    layout.profile
  );

  return (
    <g>
      <g data-drawing-layer="structure" stroke={COLORS.ink} fill="none">
        <line x1="90" y1={ELEVATION.floor} x2="910" y2={ELEVATION.floor} strokeWidth="2" />
        <line x1="110" y1={ELEVATION.ceiling} x2="110" y2={ELEVATION.floor} strokeWidth="2" />
        <line x1="890" y1={ELEVATION.ceiling} x2="890" y2={ELEVATION.floor} strokeWidth="2" />
        {/* Windows are drawn as sash-grid glyphs inside the cabinet run so they
            align with the opening segment; doors stay in the structure layer. */}
        {wall?.fixedPoints
          .filter((point) => point.type === "door")
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
            const top = layout.upperTop;
            const bottom = layout.upperBottom;
            return (
              <g key={point.id} stroke={COLORS.opening}>
                <rect x={x} y={top} width={width} height={bottom - top} strokeWidth="2" />
                <line x1={x + width / 2} y1={top} x2={x + width / 2} y2={bottom} />
                <line x1={x} y1={(top + bottom) / 2} x2={x + width} y2={(top + bottom) / 2} />
              </g>
            );
          })}
      </g>

      <g data-drawing-layer="cabinet-boundaries" stroke={COLORS.cabinet} fill="none" strokeWidth="2">
        <ElevationRun
          segments={upper}
          total={total}
          layout={layout}
          intent={intent}
          wall={wall}
          mirrored={mirrored}
          fridgeAboveHeights={fridgeAboveHeights}
        />
        <ElevationRun
          segments={base}
          total={total}
          layout={layout}
          intent={intent}
          wall={wall}
          mirrored={mirrored}
          fridgeAboveHeights={fridgeAboveHeights}
        />
      </g>

      <SheetCounterBand
        base={base}
        total={total}
        layout={layout}
        wall={wall}
        mirrored={mirrored}
      />

      <g data-drawing-layer="cabinet-numbers" fill={COLORS.number} fontFamily="var(--studio-mono)" fontSize="18" textAnchor="middle">
        {[...elevationPlacements(upper, total, mirrored), ...elevationPlacements(base, total, mirrored)].map(({ segment, x, width }) => {
          // Gaps (corner clearance, tall-unit space above a full-height unit)
          // are not cabinets — they carry no number or label.
          if (segment.kind === "gap") return null;
          const box = elevationBox(
            segment,
            layout,
            fridgeAboveHeights
          );
          const role = resolveSegmentRole(segment, wall);
          const mainLabel = segment.code ?? segment.label;
          const showMainLabel =
            segment.kind !== "opening" &&
            !(
              segment.cabinetKind === "tall" &&
              mainLabel.trim().toLowerCase() === "tall unit"
            );
          return (
            <g key={segment.id}>
              {showMainLabel && (
                <text
                  data-segment-id={segment.id}
                  x={x + width / 2}
                  y={
                    box.y +
                    box.height / 2 +
                    (segment.kind === "filler" || segment.kind === "panel"
                      ? 4
                      : 6)
                  }
                  fill={
                    segment.kind === "filler" || segment.kind === "panel"
                      ? COLORS.muted
                      : COLORS.number
                  }
                  fontSize={
                    segment.kind === "filler" || segment.kind === "panel"
                      ? "10"
                      : undefined
                  }
                  letterSpacing={
                    segment.kind === "filler" || segment.kind === "panel"
                      ? "0.08em"
                      : undefined
                  }
                >
                  {mainLabel}
                </text>
              )}
              {role && (
                <text
                  data-role-tag={role}
                  x={x + width / 2}
                  y={box.y + box.height / 2 + 24}
                  fontSize="10"
                  letterSpacing="0.08em"
                  fill={COLORS.muted}
                >
                  {SEGMENT_ROLE_TAGS[role]}
                </text>
              )}
            </g>
          );
        })}
      </g>

      <g data-drawing-layer="dimensions" stroke={COLORS.dimension} fill={COLORS.dimension} fontFamily="var(--studio-mono)" fontSize="10">
        <Dimension x1={110} x2={890} y={82} label={formatSixteenths(wall?.lengthSixteenths)} />
        {upper.length > 0 && (
          <SegmentChainDimensions
            segments={upper}
            total={total}
            mirrored={mirrored}
            baselineY={106}
            direction={-1}
          />
        )}
        {base.length > 0 && (
          <SegmentChainDimensions
            segments={base}
            total={total}
            mirrored={mirrored}
            baselineY={ELEVATION.floor + 26}
            direction={1}
          />
        )}
        <DimensionVertical
          x={932}
          y1={ELEVATION.ceiling}
          y2={ELEVATION.floor}
          label={formatSixteenths(model?.ceilingHeightSixteenths)}
        />
        <DimensionVertical
          x={910}
          y1={layout.baseBodyTop}
          y2={ELEVATION.floor}
          label={formatSixteenths(baseBodyHeightSixteenths(layout.profile))}
        />
        <DimensionVertical
          x={910}
          y1={layout.upperTop}
          y2={layout.upperBottom}
          label={formatSixteenths(layout.profile.upperHeightSixteenths)}
        />
        {/* Tall units (refrigerator, oven/pantry towers) run floor-to-cabinet-top
            and have no counter/upper split, so they get their own overall
            height dimension inside the column. */}
        <g data-drawing-layer="tall-height">
          {elevationPlacements(base, total, mirrored)
            .filter(({ segment }) => segment.cabinetKind === "tall")
            .map(({ segment, x, width }) => {
              // A capped tall unit (wall cabinet / panel above) ends at the
              // upper band's underside, so its height chain does too.
              const aboveHeight = fridgeAboveHeightForSegment(
                segment,
                fridgeAboveHeights
              );
              const fridgeTop =
                aboveHeight == null
                  ? layout.upperTop
                  : layout.upperTop + aboveHeight * layout.scale;
              const fridgeHeight =
                aboveHeight == null
                  ? tallUnitHeightSixteenths(layout.profile)
                  : tallUnitHeightSixteenths(layout.profile) - aboveHeight;
              return (
                <g key={`tall-height-${segment.id}`}>
                  {aboveHeight != null && (
                    <g data-fridge-above-height={formatSixteenths(aboveHeight)}>
                      <DimensionVertical
                        x={x + Math.min(16, width / 2)}
                        y1={layout.upperTop}
                        y2={fridgeTop}
                        label={formatSixteenths(aboveHeight)}
                      />
                    </g>
                  )}
                  <g data-fridge-height={formatSixteenths(fridgeHeight)}>
                    <DimensionVertical
                      x={x + Math.min(16, width / 2) + (aboveHeight == null ? 0 : 10)}
                      y1={fridgeTop}
                      y2={ELEVATION.floor}
                      label={formatSixteenths(fridgeHeight)}
                    />
                  </g>
                </g>
              );
            })}
        </g>
      </g>

      <text
        data-drawing-layer="depth-note"
        x="500"
        y={ELEVATION.floor + 52}
        textAnchor="middle"
        fontFamily="var(--studio-mono)"
        fontSize="11"
        fontWeight="bold"
        fill={COLORS.dimension}
      >
        {`BASE ${formatSixteenths(CABINET_STANDARDS.depths.baseSixteenths)} DEEP · UPPER ${formatSixteenths(CABINET_STANDARDS.depths.upperSixteenths)} DEEP`}
      </text>

      <g fontFamily="var(--studio-mono)" fill={COLORS.muted} fontSize="9">
        <text x="500" y="622" textAnchor="middle">
          WALL {wall?.label ?? "?"} ELEVATION · CABINET IDENTIFICATION AND CONTROL DIMENSIONS
        </text>
      </g>
    </g>
  );
}

/**
 * Countertop over the straight base run on the A-sheet: one poché slab per
 * contiguous run of counter-topped base segments (tall units and freestanding
 * ranges break it), drawn on top of the cabinet boxes with a solid surface
 * line so the base body reads below it.
 */
function SheetCounterBand({
  base,
  total,
  layout,
  wall,
  mirrored
}: {
  base: WallSegment[];
  total: number;
  layout: SheetVerticalLayout;
  wall: Round2Wall | null;
  mirrored: boolean;
}) {
  const thickness = layout.baseBodyTop - layout.baseTop;
  if (thickness <= 0) return null;

  const placements = elevationPlacements(base, total, mirrored)
    .slice()
    .sort((a, b) => a.x - b.x);

  const bands: { start: number; end: number }[] = [];
  for (const { segment, x, width } of placements) {
    if (!hasCountertop(segment, wall)) continue;
    const previous = bands[bands.length - 1];
    if (previous && Math.abs(previous.end - x) < 0.5) {
      previous.end = x + width;
    } else {
      bands.push({ start: x, end: x + width });
    }
  }
  if (bands.length === 0) return null;

  const overhang = 4;
  return (
    <g data-drawing-layer="countertop">
      {bands.map((band, index) => {
        const left = Math.max(110, band.start - overhang);
        const right = Math.min(890, band.end + overhang);
        return (
          <g key={index} data-countertop-band={index}>
            <rect
              x={left}
              y={layout.baseTop}
              width={Math.max(1, right - left)}
              height={thickness}
              fill="#e8e5dd"
              stroke={COLORS.ink}
              strokeWidth="1.5"
            />
            <line
              x1={left}
              y1={layout.baseTop}
              x2={right}
              y2={layout.baseTop}
              stroke={COLORS.ink}
              strokeWidth="2.5"
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Per-segment dimension chain with staggered lanes so narrow neighbors never
 * run their labels together.
 */
function SegmentChainDimensions({
  segments,
  total,
  mirrored,
  baselineY,
  direction
}: {
  segments: WallSegment[];
  total: number;
  mirrored: boolean;
  baselineY: number;
  direction: 1 | -1;
}) {
  const placements = elevationPlacements(segments, total, mirrored);
  const lanes = assignDimensionLanes(
    placements.map(({ width }) => width),
    52
  );
  return (
    <g data-drawing-layer="segment-chain">
      <line x1={110} y1={baselineY} x2={890} y2={baselineY} strokeWidth="0.75" />
      {placements.map(({ segment, x, width }, index) => {
        if (segment.kind === "gap") return null;
        const labelY = baselineY + direction * (4 + lanes[index] * 14);
        return (
          <g key={segment.id}>
            <line x1={x} y1={baselineY - 5} x2={x} y2={baselineY + 5} strokeWidth="0.75" />
            {lanes[index] > 0 && (
              <line
                x1={x + width / 2}
                y1={baselineY}
                x2={x + width / 2}
                y2={labelY - direction * 4}
                strokeWidth="0.5"
              />
            )}
            <text
              x={x + width / 2}
              y={labelY + (direction === 1 ? 8 : 0)}
              textAnchor="middle"
              stroke="none"
            >
              {formatSixteenths(segment.widthSixteenths)}
            </text>
          </g>
        );
      })}
      <line x1={890} y1={baselineY - 5} x2={890} y2={baselineY + 5} strokeWidth="0.75" />
    </g>
  );
}

function ElevationRun({
  segments,
  total,
  layout,
  intent,
  wall,
  mirrored,
  fridgeAboveHeights
}: {
  segments: WallSegment[];
  total: number;
  layout: SheetVerticalLayout;
  intent?: Round2DesignIntent;
  wall: Round2Wall | null;
  mirrored: boolean;
  fridgeAboveHeights?: ReadonlyMap<string, number>;
}) {
  return (
    <g>
      {elevationPlacements(segments, total, mirrored).map(({ segment, x, width }) => {
        const { y, height } = elevationBox(
          segment,
          layout,
          fridgeAboveHeights
        );
        if (segment.kind === "gap") return null;
        const front = resolveSegmentFront(segment, intent);
        const role = resolveSegmentRole(segment, wall);
        // Pure appliance boxes (DW/range/fridge/oven/microwave) show the
        // appliance itself, not a cabinet door face; the sink base keeps its
        // doors under the faucet.
        const isApplianceBox = segment.kind === "appliance" && role != null && role !== "sink";
        const isWindow =
          segment.kind === "opening" &&
          wall?.fixedPoints.find((point) => point.id === segment.sourceFixedPointId)
            ?.type === "window";
        return (
          <g key={segment.id}>
            <rect
              x={x}
              y={y}
              width={Math.max(2, width)}
              height={height}
              fill={
                segment.kind === "panel"
                  ? "#efe6f2"
                  : segment.kind === "filler"
                    ? "#fff7d8"
                    : isWindow
                      ? "#eef6fb"
                      : "#fff"
              }
              stroke={
                segment.kind === "filler"
                  ? COLORS.filler
                  : isWindow
                    ? COLORS.opening
                    : COLORS.cabinet
              }
            />
            {segment.kind !== "filler" &&
              segment.kind !== "panel" &&
              segment.kind !== "opening" &&
              !isApplianceBox && (
              <CabinetFace
                x={x}
                y={y}
                width={Math.max(2, width)}
                height={height}
                front={front}
              />
            )}
            {isWindow && (
              <WindowGlyph
                x={x}
                y={y}
                width={Math.max(2, width)}
                height={height}
                stroke={COLORS.opening}
              />
            )}
            {role && (
              <ApplianceGlyph
                role={role}
                x={x}
                y={y}
                width={Math.max(2, width)}
                height={height}
                stroke={COLORS.ink}
              />
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
  height,
  front
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  front: ResolvedFront | null;
}) {
  if (front && front.drawerStack.length > 0) {
    const totalUnits = front.drawerStack.reduce((sum, unit) => sum + unit, 0);
    let offset = 0;
    return (
      <g stroke={COLORS.ink} fill="none" strokeWidth="1.1" data-face="drawers">
        <rect x={x + 3} y={y + 3} width={Math.max(1, width - 6)} height={height - 6} />
        {front.drawerStack.map((unit, index) => {
          offset += unit;
          const lineY = y + 3 + (offset / totalUnits) * (height - 6);
          return index < front.drawerStack.length - 1 ? (
            <line key={index} x1={x + 3} y1={lineY} x2={x + width - 3} y2={lineY} />
          ) : null;
        })}
      </g>
    );
  }

  const doors = front?.doorCount ?? 2;
  return (
    <g stroke={COLORS.ink} fill="none" strokeWidth="1.1" data-face={doors === 1 ? "single-door" : "double-door"}>
      <rect x={x + 3} y={y + 3} width={Math.max(1, width - 6)} height={height - 6} />
      {doors === 2 && width > 34 && (
        <line x1={x + width / 2} y1={y + 3} x2={x + width / 2} y2={y + height - 3} />
      )}
      <path d={`M ${x + 3} ${y + 3} L ${x + width / 2} ${y + height / 2} L ${x + 3} ${y + height - 3}`} stroke={COLORS.number} />
      {doors === 2 && (
        <path d={`M ${x + width - 3} ${y + 3} L ${x + width / 2} ${y + height / 2} L ${x + width - 3} ${y + height - 3}`} stroke={COLORS.number} />
      )}
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

// Elevation canvas: the floor and ceiling lines are fixed; every cabinet
// height in between scales from the model height profile.
const ELEVATION = { floor: 562, ceiling: 120 } as const;

type SheetVerticalLayout = {
  /** Finished counter top (backsplash + counter-slab datum). */
  baseTop: number;
  /** Top of the base cabinet body; the counter slab fills baseTop→here. */
  baseBodyTop: number;
  upperTop: number;
  upperBottom: number;
  scale: number;
  profile: Round2HeightProfile;
};

function sheetVerticalLayout(model: Round2Model | null): SheetVerticalLayout {
  const vertical = CABINET_STANDARDS.vertical;
  const profile = model?.heightProfile ?? {
    counterSixteenths: vertical.finishedCounterHeightSixteenths,
    backsplashSixteenths: vertical.backsplashMinSixteenths,
    upperHeightSixteenths:
      CABINET_STANDARDS.upper.standardHeightsSixteenths[1],
    mouldingSixteenths: vertical.flatMoulding.preferredSixteenths
  };
  const ceiling = model?.ceilingHeightSixteenths ?? 96 * 16;
  const scale = (ELEVATION.floor - ELEVATION.ceiling) / Math.max(1, ceiling);
  const baseTop = ELEVATION.floor - profile.counterSixteenths * scale;
  const baseBodyTop = baseTop + counterThicknessSixteenths(profile) * scale;
  const upperBottom = baseTop - profile.backsplashSixteenths * scale;
  const upperTop = upperBottom - profile.upperHeightSixteenths * scale;
  return { baseTop, baseBodyTop, upperTop, upperBottom, scale, profile };
}

/** Countertop thickness = finished counter height minus the base body height. */
function counterThicknessSixteenths(profile: Round2HeightProfile): number {
  return Math.max(
    0,
    profile.counterSixteenths - CABINET_STANDARDS.base.heightSixteenths
  );
}

/** Base cabinet body height = finished counter height minus the slab. */
function baseBodyHeightSixteenths(profile: Round2HeightProfile): number {
  return profile.counterSixteenths - counterThicknessSixteenths(profile);
}

/** A base run segment carries a counter unless it is tall or a freestanding range. */
function hasCountertop(segment: WallSegment, wall: Round2Wall | null): boolean {
  if (segment.tier !== "base") return false;
  if (segment.cabinetKind === "tall") return false;
  if (segment.kind === "panel") return false;
  if (segment.kind === "opening" || segment.kind === "gap") return false;
  return resolveSegmentRole(segment, wall) !== "range";
}

/**
 * A tall unit spans floor to cabinet-top — the same height as counter +
 * backsplash + upper, which is where the upper cabinets terminate. Matches the
 * floor→upperTop pixel span used by elevationBox for tall segments.
 */
function tallUnitHeightSixteenths(profile: Round2HeightProfile): number {
  return (
    profile.counterSixteenths +
    profile.backsplashSixteenths +
    profile.upperHeightSixteenths
  );
}

function elevationBox(
  segment: WallSegment,
  layout: SheetVerticalLayout,
  fridgeAboveHeights: ReadonlyMap<string, number> = EMPTY_ABOVE_HEIGHTS
): { y: number; height: number } {
  const aboveHeight = fridgeAboveHeightForSegment(segment, fridgeAboveHeights);
  if (aboveHeight != null) {
    if (isFridgeAboveUnit(segment, fridgeAboveHeights)) {
      return { y: layout.upperTop, height: aboveHeight * layout.scale };
    }
    if (isCappedFridge(segment, fridgeAboveHeights)) {
      const top = layout.upperTop + aboveHeight * layout.scale;
      return { y: top, height: ELEVATION.floor - top };
    }
  }
  if (segment.tier === "upper") {
    return {
      y: layout.upperTop,
      height: layout.upperBottom - layout.upperTop
    };
  }
  if (
    segment.tier === "full" ||
    segment.cabinetKind === "tall" ||
    segment.kind === "panel"
  ) {
    return { y: layout.upperTop, height: ELEVATION.floor - layout.upperTop };
  }
  return { y: layout.baseTop, height: ELEVATION.floor - layout.baseTop };
}

const EMPTY_ABOVE_HEIGHTS: ReadonlyMap<string, number> = new Map();

function elevationPlacements(
  segments: WallSegment[],
  total: number,
  mirrored = false
) {
  let cursor = 0;
  return segments.map((segment) => {
    const width = (Math.max(0, segment.widthSixteenths) / total) * 780;
    const placement = {
      segment,
      x: mirrored ? 110 + 780 - cursor - width : 110 + cursor,
      width
    };
    cursor += width;
    return placement;
  });
}

function isMirroredElevationWall(wall: Round2Wall | null): boolean {
  // LEFT walls are measured top-to-bottom in plan. From inside the room, that
  // top/back corner appears on the right side of the wall elevation.
  return wall?.sourceWall === "LEFT";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
