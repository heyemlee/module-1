"use client";

import { useId, useState, type Dispatch } from "react";
import { cn } from "@/lib/utils";
import {
  findWall,
  formatSixteenths,
  type CabinetKind,
  type FrontAccessory,
  type Round2FixedPoint,
  type Round2HeightProfile,
  type Round2Model,
  type WallId,
  type WallSegment
} from "../model/round2-model";
import {
  resolveSegmentRole,
  SEGMENT_ROLE_TAGS
} from "../model/segment-role";
import { ApplianceGlyph, WindowGlyph } from "../appliance-glyphs";
import { CABINET_STANDARDS } from "../model/cabinet-standards";
import { standardWidthOptionsSixteenths } from "../model/adjustments";
import { assignDimensionLanes } from "../model/dimension-lanes";
import {
  ACCESSORY_LABELS,
  describeFront,
  resolveSegmentFront,
  type ResolvedFront
} from "../model/front";
import type {
  CornerStrategy,
  Round2DesignIntent
} from "../model/design-intent";
import { deriveCorners, type CornerEnd } from "../model/corners";
import type {
  Round2AbsorbedChange,
  Round2PrototypeAction
} from "../round2-types";
import { InchField } from "../measurement/inch-field";

// Elevation canvas: the floor line and the ceiling span are fixed in pixels;
// everything vertical in between scales from the model height profile.
const RUN_LEFT = 70;
const RUN_WIDTH = 500;
const FLOOR_Y = 346;
const CEILING_Y = 82;
const MIN_LABEL_PX = 34;
const LANE_STEP = 11;
const DIMENSION_COLOR = "#079ca5";
const DIMENSION_FONT_SIZE = 11;
const DIMENSION_STROKE_WIDTH = 2;
const WIDTH_CHAIN_EXTENSION_LENGTH = 8;
const OVERALL_DIMENSION_LABEL_Y = 19;
const OVERALL_DIMENSION_GUIDE_Y = 29;
// Three upper dimension rows occupy y=19, 42, and 64. Keeping this row
// independent of the ceiling lets the full elevation sit lower without
// pushing a dimension chain through the ceiling datum.
const UPPER_CHAIN_LABEL_Y = 42;
const CABINET_FACE_STROKE = "#a7aaa5";
const TALL_HEIGHT_CHAIN_X = 32;
const TALL_HEIGHT_LABEL_X = 20;
// Corner returns follow NKBA section conventions: sectioned side profile in
// amber hatch, hidden carcass in dashed gray, counter cut in dark poché, and
// a parenthesized depth reference kept out of the teal cabinet chain.
const CORNER_SECTION_COLOR = "#8a6a1c";
const CORNER_RETURN_FILL = "transparent";
const HIDDEN_LINE_COLOR = "#8a8d83";
const COUNTER_SECTION_FILL = "#44443e";
const COUNTER_THICKNESS_SIXTEENTHS = 24; // 1.5″
const TOE_KICK_HEIGHT_SIXTEENTHS = 72; // 4.5″
const TOE_KICK_DEPTH_SIXTEENTHS = 48; // 3″

/** Where a secondary-wall corner return jumps to: the hosting cabinet. */
type CornerReturnTarget = {
  side: CornerEnd;
};

type VerticalLayout = {
  scale: number;
  baseTop: number;
  upperTop: number;
  upperBottom: number;
  profile: Round2HeightProfile;
};

function verticalLayout(model: Round2Model | null): VerticalLayout {
  const vertical = CABINET_STANDARDS.vertical;
  const profile = model?.heightProfile ?? {
    counterSixteenths: vertical.finishedCounterHeightSixteenths,
    backsplashSixteenths: vertical.backsplashMinSixteenths,
    upperHeightSixteenths:
      CABINET_STANDARDS.upper.standardHeightsSixteenths[1],
    mouldingSixteenths: vertical.flatMoulding.preferredSixteenths
  };
  const ceiling = model?.ceilingHeightSixteenths ?? 96 * 16;
  const scale = (FLOOR_Y - CEILING_Y) / Math.max(1, ceiling);
  const baseTop = FLOOR_Y - profile.counterSixteenths * scale;
  const upperBottom = baseTop - profile.backsplashSixteenths * scale;
  const upperTop = upperBottom - profile.upperHeightSixteenths * scale;
  return { scale, baseTop, upperTop, upperBottom, profile };
}

function segmentBox(
  segment: WallSegment,
  layout: VerticalLayout
): { y: number; height: number } {
  if (segment.tier === "upper") {
    return { y: layout.upperTop, height: layout.upperBottom - layout.upperTop };
  }
  if (segment.tier === "full" || segment.cabinetKind === "tall") {
    return { y: layout.upperTop, height: FLOOR_Y - layout.upperTop };
  }
  return { y: layout.baseTop, height: FLOOR_Y - layout.baseTop };
}

function segmentFill(segment: WallSegment) {
  if (segment.cabinetKind === "sink") return "#eef7f4";
  if (segment.cabinetKind === "tall") return "#f1ecf7";
  if (segment.cabinetKind === "corner") return "#f4efe2";
  if (segment.kind === "opening") return "#dceff7";
  if (segment.kind === "appliance") return "#edf5f7";
  if (isFillerLikeSegment(segment)) return "#fdf9eb";
  return "#fbfbf8";
}

export function WallElevation({
  wallId,
  model,
  designIntent,
  selectedObjectId,
  lastAbsorbed = null,
  canEdit = false,
  onSelect,
  onSelectWall,
  dispatch
}: {
  wallId: WallId | null;
  model: Round2Model | null;
  designIntent?: Round2DesignIntent;
  selectedObjectId: string | null;
  lastAbsorbed?: Round2AbsorbedChange | null;
  canEdit?: boolean;
  onSelect: (id: string, wall: WallId) => void;
  onSelectWall?: (wall: WallId) => void;
  dispatch?: Dispatch<Round2PrototypeAction>;
}) {
  const wall = findWall(model, wallId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const total =
    wall?.lengthSixteenths ??
    wall?.segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0) ??
    1;
  const layout = verticalLayout(model);
  const upper = wall?.segments.filter((segment) => segment.tier === "upper") ?? [];
  const base = wall?.segments.filter((segment) => segment.tier !== "upper") ?? [];
  const mirrored = isMirroredElevationWall(wall);
  const editingSegment =
    wall?.segments.find((segment) => segment.id === editingId) ?? null;
  const cornerReturns = buildCornerReturnTargets(model, wall);
  const cornerEnds = insideCornerEnds(model, wall);
  const cornerHostSides = buildCornerHostSides(model, wall);
  const hatchPatternId = `${useId().replaceAll(":", "")}-corner-hatch`;
  const openEditor = (segment: WallSegment) => {
    onSelect(segment.id, wall?.id ?? "");
    if (!canEdit || !dispatch) return;
    if (!canOpenSegmentEditor(segment)) return;
    setEditingId(segment.id === editingId ? null : segment.id);
  };

  return (
    <div className="relative h-full min-h-[440px] overflow-hidden rounded-[18px] border border-studio-line bg-white shadow-[0_18px_42px_-30px_rgba(20,20,26,0.28)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[68px] opacity-100 [background-image:linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div
        data-elevation-layer="header"
        className="relative z-10 flex items-center justify-between border-b border-studio-line/40 bg-white px-4 py-3"
      >
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-black/45">
            ELEVATION · PRIMARY EDITOR
          </p>
          <div className="mt-1.5 flex items-center gap-1 rounded-[8px] border border-studio-line/40 bg-white p-0.5 shadow-sm">
            {(model?.walls ?? []).map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={wallId === w.id}
                onClick={() => {
                  setEditingId(null);
                  onSelectWall?.(w.id);
                }}
                className={cn(
                  "flex h-7 px-3 items-center justify-center rounded-[6px] font-mono text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-studio-action",
                  wallId === w.id
                    ? "bg-studio-ink text-white"
                    : "text-black/60 hover:bg-black/5 hover:text-studio-ink"
                )}
              >
                Wall {w.label}
              </button>
            ))}
          </div>
        </div>
        <span className="font-mono text-[9px] text-black/45">1:30</span>
      </div>

      <svg
        viewBox="0 0 640 400"
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={wall ? `Wall ${wall.label} cabinet elevation` : "Cabinet elevation"}
        className="relative z-10 h-[calc(100%-68px)] min-h-[360px] w-full"
      >
        <g data-elevation-layer="dimensions" stroke={DIMENSION_COLOR} fill={DIMENSION_COLOR} fontFamily="var(--studio-mono)">
          <path
            data-chain-guide="overall"
            d={`M 70 ${OVERALL_DIMENSION_GUIDE_Y - WIDTH_CHAIN_EXTENSION_LENGTH} V ${OVERALL_DIMENSION_GUIDE_Y + WIDTH_CHAIN_EXTENSION_LENGTH} M 570 ${OVERALL_DIMENSION_GUIDE_Y - WIDTH_CHAIN_EXTENSION_LENGTH} V ${OVERALL_DIMENSION_GUIDE_Y + WIDTH_CHAIN_EXTENSION_LENGTH} M 70 ${OVERALL_DIMENSION_GUIDE_Y} H 570`}
            strokeWidth={DIMENSION_STROKE_WIDTH}
          />
          <text
            data-chain-label="overall"
            x="320"
            y={OVERALL_DIMENSION_LABEL_Y}
            textAnchor="middle"
            fontSize={DIMENSION_FONT_SIZE}
            fontWeight="bold"
            stroke="none"
            fill={DIMENSION_COLOR}
          >
            {formatSixteenths(wall?.lengthSixteenths)}
          </text>
          <HeightChain model={model} layout={layout} />
        </g>

        <defs>
          <pattern
            id={hatchPatternId}
            width="7"
            height="7"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="7" height="7" fill={CORNER_RETURN_FILL} />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke={CORNER_SECTION_COLOR}
              strokeWidth="1.1"
              strokeOpacity="0.65"
            />
          </pattern>
        </defs>
        <line x1="70" y1={FLOOR_Y} x2="570" y2={FLOOR_Y} stroke="#292929" strokeWidth="2" />
        <line
          x1="70"
          y1={CEILING_Y}
          x2="570"
          y2={CEILING_Y}
          stroke="#292929"
          strokeWidth="1"
          strokeDasharray="7 5"
        />
        {wall &&
          cornerEnds.map((end) => {
            const atLeft = mirrored ? end === "end" : end === "start";
            const x = atLeft ? RUN_LEFT : RUN_LEFT + RUN_WIDTH;
            return (
              <line
                key={end}
                data-elevation-layer="inside-corner"
                x1={x}
                y1={CEILING_Y - 6}
                x2={x}
                y2={FLOOR_Y + 6}
                stroke="#292929"
                strokeWidth="4"
              />
            );
          })}
        {wall ? (
          <>
            <ElevationRun
              fixedPoints={wall.fixedPoints}
              segments={upper}
              total={total}
              layout={layout}
              designIntent={designIntent}
              labelSide="above"
              selectedObjectId={selectedObjectId}
              lastAbsorbed={lastAbsorbed}
              mirrored={mirrored}
              cornerReturns={cornerReturns}
              cornerHostSides={cornerHostSides}
              hatchPatternId={hatchPatternId}
              onActivate={openEditor}
            />
            <ElevationRun
              fixedPoints={wall.fixedPoints}
              segments={base}
              total={total}
              layout={layout}
              designIntent={designIntent}
              labelSide="below"
              selectedObjectId={selectedObjectId}
              lastAbsorbed={lastAbsorbed}
              mirrored={mirrored}
              cornerReturns={cornerReturns}
              cornerHostSides={cornerHostSides}
              hatchPatternId={hatchPatternId}
              onActivate={openEditor}
            />
            {[...cornerHostSides.entries()].map(([cornerId, end]) => {
              const hostsCorner = wall.segments.some(
                (segment) =>
                  segment.sourceCornerId === cornerId &&
                  segment.kind === "cabinet"
              );
              if (!hostsCorner) return null;
              return (
                <CornerSideProfile
                  key={cornerId}
                  atLeft={mirrored ? end === "end" : end === "start"}
                  layout={layout}
                  pxPerSixteenth={RUN_WIDTH / total}
                  hatchPatternId={hatchPatternId}
                />
              );
            })}
            <g stroke={DIMENSION_COLOR} fill={DIMENSION_COLOR} fontFamily="var(--studio-mono)">
              <TallUnitHeights base={base} total={total} layout={layout} />
            </g>
          </>
        ) : (
          <text
            x="320"
            y="198"
            textAnchor="middle"
            fontFamily="var(--studio-mono)"
            fontSize="12"
            fill="#8b8b85"
          >
            SUBMIT MEASUREMENTS TO AUTOFILL
          </text>
        )}
      </svg>

      {canEdit && dispatch && wall && editingSegment && (
        <SegmentEditorCard
          segment={editingSegment}
          designIntent={designIntent}
          dispatch={dispatch}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function HeightChain({
  model,
  layout
}: {
  model: Round2Model | null;
  layout: VerticalLayout;
}) {
  const { profile } = layout;
  return (
    <g data-elevation-layer="height-chain">
      <path
        d={`M 586 ${CEILING_Y} H 598 M 586 ${FLOOR_Y} H 598 M 592 ${CEILING_Y} V ${FLOOR_Y}`}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <text
        data-height-label="ceiling"
        x="611"
        y={(CEILING_Y + FLOOR_Y) / 2}
        textAnchor="middle"
        fontSize={DIMENSION_FONT_SIZE}
        fontWeight="bold"
        fill={DIMENSION_COLOR}
        stroke="none"
        transform={`rotate(90 611 ${(CEILING_Y + FLOOR_Y) / 2})`}
      >
        {formatSixteenths(model?.ceilingHeightSixteenths)}
      </text>
      <path
        d={`M 58 ${layout.baseTop} H 66 M 58 ${FLOOR_Y} H 66 M 62 ${layout.baseTop} V ${FLOOR_Y}`}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <text
        data-height-label="counter"
        x="49"
        y={(layout.baseTop + FLOOR_Y) / 2}
        textAnchor="middle"
        fontSize={DIMENSION_FONT_SIZE}
        fontWeight="bold"
        fill={DIMENSION_COLOR}
        stroke="none"
        transform={`rotate(-90 49 ${(layout.baseTop + FLOOR_Y) / 2})`}
      >
        {formatSixteenths(profile.counterSixteenths)}
      </text>
      <path
        d={`M 58 ${layout.upperTop} H 66 M 58 ${layout.upperBottom} H 66 M 62 ${layout.upperTop} V ${layout.upperBottom}`}
        strokeWidth={DIMENSION_STROKE_WIDTH}
      />
      <text
        data-height-label="upper"
        x="49"
        y={(layout.upperTop + layout.upperBottom) / 2}
        textAnchor="middle"
        fontSize={DIMENSION_FONT_SIZE}
        fontWeight="bold"
        fill={DIMENSION_COLOR}
        stroke="none"
        transform={`rotate(-90 49 ${(layout.upperTop + layout.upperBottom) / 2})`}
      >
        {formatSixteenths(profile.upperHeightSixteenths)}
      </text>
    </g>
  );
}

/**
 * Tall units (refrigerator, oven/pantry towers) run floor-to-cabinet-top with
 * no counter/upper split, so each gets its own overall height dimension drawn
 * inside its column — mirroring the A-sheet.
 */
function TallUnitHeights({
  base,
  total,
  layout
}: {
  base: WallSegment[];
  total: number;
  layout: VerticalLayout;
}) {
  const height =
    layout.profile.counterSixteenths +
    layout.profile.backsplashSixteenths +
    layout.profile.upperHeightSixteenths;
  let cursor = 0;
  let tallLane = 0;
  return (
    <g data-elevation-layer="tall-height">
      {base.map((segment) => {
        const widthPx = (Math.max(0, segment.widthSixteenths) / total) * RUN_WIDTH;
        cursor += widthPx;
        if (segment.cabinetKind !== "tall") return null;
        const x = TALL_HEIGHT_CHAIN_X - tallLane * 12;
        const labelX = TALL_HEIGHT_LABEL_X - tallLane * 12;
        tallLane += 1;
        const mid = (layout.upperTop + FLOOR_Y) / 2;
        return (
          <g key={`tall-${segment.id}`}>
            <path
              d={`M ${x - 4} ${layout.upperTop} H ${x + 4} M ${x - 4} ${FLOOR_Y} H ${x + 4} M ${x} ${layout.upperTop} V ${FLOOR_Y}`}
              strokeWidth={DIMENSION_STROKE_WIDTH}
            />
            <text
              data-tall-height-label={segment.id}
              x={labelX}
              y={mid}
              textAnchor="middle"
              fontSize={DIMENSION_FONT_SIZE}
              fontWeight="bold"
              transform={`rotate(-90 ${labelX} ${mid})`}
              stroke="none"
            >
              {formatSixteenths(height)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ElevationRun({
  fixedPoints,
  segments,
  total,
  layout,
  designIntent,
  labelSide,
  selectedObjectId,
  lastAbsorbed,
  mirrored,
  cornerReturns,
  cornerHostSides,
  hatchPatternId,
  onActivate
}: {
  fixedPoints: Round2FixedPoint[];
  segments: WallSegment[];
  total: number;
  layout: VerticalLayout;
  designIntent?: Round2DesignIntent;
  labelSide: "above" | "below";
  selectedObjectId: string | null;
  lastAbsorbed?: Round2AbsorbedChange | null;
  mirrored: boolean;
  cornerReturns?: Map<string, CornerReturnTarget>;
  cornerHostSides?: Map<string, CornerEnd>;
  hatchPatternId?: string;
  onActivate: (segment: WallSegment) => void;
}) {
  const widthsPx = segments.map(
    (segment) => (Math.max(0, segment.widthSixteenths) / total) * RUN_WIDTH
  );
  const lanes = assignDimensionLanes(widthsPx, MIN_LABEL_PX);
  const labelClipIdPrefix = useId().replaceAll(":", "");
  let cursor = 0;

  return (
    <g>
      {segments.map((segment, index) => {
        const width = widthsPx[index];
        const x = mirrored
          ? RUN_LEFT + RUN_WIDTH - cursor - width
          : RUN_LEFT + cursor;
        cursor += width;
        const { y, height } = segmentBox(segment, layout);
        const selected = selectedObjectId === segment.id;
        const cornerReturn =
          segment.kind === "gap" && segment.sourceCornerId
            ? cornerReturns?.get(segment.sourceCornerId) ??
              fallbackCornerReturn(index, segments.length)
            : null;
        if (cornerReturn) {
          const cornerAtLeft = mirrored
            ? cornerReturn.side === "end"
            : cornerReturn.side === "start";
          const labelY =
            labelSide === "below" ? FLOOR_Y + 22 : UPPER_CHAIN_LABEL_Y;
          const guideY = labelSide === "below" ? FLOOR_Y + 12 : labelY + 5;
          return (
            <g
              key={segment.id}
              data-segment-id={segment.id}
              data-cabinet-id={segment.id}
              data-selected={selected}
              onClick={() => onActivate(segment)}
              className="cursor-pointer"
            >
              <title>{segment.code ?? segment.label}</title>
              <CornerReturnSection
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                tier={segment.tier}
                layout={layout}
                pxPerSixteenth={RUN_WIDTH / total}
                cornerAtLeft={cornerAtLeft}
                selected={selected}
                hatchPatternId={hatchPatternId}
              />
              <g data-elevation-layer="width-chain">
                <path
                  data-chain-guide={segment.id}
                  d={
                    labelSide === "above"
                      ? `M ${x} ${guideY} V ${guideY + WIDTH_CHAIN_EXTENSION_LENGTH} M ${x} ${guideY} H ${x + width} M ${x + width} ${guideY + WIDTH_CHAIN_EXTENSION_LENGTH} V ${guideY}`
                      : `M ${x} ${guideY} V ${guideY - WIDTH_CHAIN_EXTENSION_LENGTH} M ${x} ${guideY} H ${x + width} M ${x + width} ${guideY - WIDTH_CHAIN_EXTENSION_LENGTH} V ${guideY}`
                  }
                  stroke={DIMENSION_COLOR}
                  strokeWidth={DIMENSION_STROKE_WIDTH}
                  fill="none"
                />
                <text
                  data-chain-label={segment.id}
                  x={x + width / 2}
                  y={labelY}
                  textAnchor="middle"
                  fontFamily="var(--studio-mono)"
                  fontSize={DIMENSION_FONT_SIZE}
                  fontWeight="bold"
                  stroke="none"
                  fill={DIMENSION_COLOR}
                >
                  {formatSixteenths(segment.widthSixteenths)}
                </text>
              </g>
              <CornerHostBreakdownDimensions
                segmentId={segment.id}
                x={x}
                width={width}
                tier={segment.tier}
                total={total}
                atLeft={cornerAtLeft}
                labelSide={labelSide}
              />
            </g>
          );
        }
        // A hosted corner cabinet is partly covered by the adjacent run's
        // side profile; its face lives in the remaining visible zone.
        const hostedCornerEnd =
          segment.kind === "cabinet" &&
          segment.cabinetKind === "corner" &&
          segment.sourceCornerId
            ? cornerHostSides?.get(segment.sourceCornerId) ?? null
            : null;
        const upperCornerEnd =
          segment.tier === "upper" && segment.kind === "cabinet"
            ? [...(cornerHostSides?.values() ?? [])].find(
                (end) =>
                  (end === "start" && index === 0) ||
                  (end === "end" && index === segments.length - 1)
              ) ?? null
            : null;
        const breakdownCornerEnd = hostedCornerEnd ?? upperCornerEnd;
        const breakdownAtLeft =
          breakdownCornerEnd != null &&
          (mirrored
            ? breakdownCornerEnd === "end"
            : breakdownCornerEnd === "start");
        const fillerLike = isFillerLikeSegment(segment);
        const front =
          fillerLike ||
          segment.cabinetKind === "corner" ||
          breakdownCornerEnd != null
            ? null
            : resolveSegmentFront(segment, designIntent);
        const role = resolveSegmentRole(segment, { fixedPoints });
        const roleTag = role ? SEGMENT_ROLE_TAGS[role] : null;
        const isWindow =
          segment.kind === "opening" &&
          fixedPoints.find((point) => point.id === segment.sourceFixedPointId)
            ?.type === "window";
        const lane = 0;
        const clipId = `${labelClipIdPrefix}-${sanitizeSvgId(segment.id)}-label`;
        const hostedAtLeft =
          hostedCornerEnd != null &&
          (mirrored ? hostedCornerEnd === "end" : hostedCornerEnd === "start");
        const hostedOverlap =
          hostedCornerEnd != null
            ? Math.min(
                width,
                CABINET_STANDARDS.depths.baseSixteenths * (RUN_WIDTH / total)
              )
            : 0;
        const labelY =
          labelSide === "below"
            ? FLOOR_Y + 22 + lane * LANE_STEP
            : UPPER_CHAIN_LABEL_Y - lane * LANE_STEP;
        const guideY =
          labelSide === "below" ? FLOOR_Y + 12 : labelY + 5;
        return (
          <g
            key={segment.id}
            data-segment-id={segment.id}
            data-cabinet-id={segment.id}
            data-selected={selected}
            onClick={() => onActivate(segment)}
            className="cursor-pointer"
          >
            <clipPath id={clipId}>
              <rect x={x} y={y} width={Math.max(8, width)} height={height} />
            </clipPath>
            <title>{segment.code ?? segment.label}</title>
            <rect
              x={x}
              y={y}
              width={Math.max(8, width)}
              height={height}
              fill={segmentFill(segment)}
              fillOpacity={1}
              stroke={selected ? "#079ca5" : "#2c2c2c"}
              strokeWidth={selected ? 3 : 1.5}
            />
            {front && hostedCornerEnd == null && (
              <SegmentFace
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                front={front}
                accent={CABINET_FACE_STROKE}
                role={role}
              />
            )}
            {front && hostedCornerEnd != null && (
              <CornerFrontFace
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                overlap={hostedOverlap}
                atLeft={hostedAtLeft}
                front={front}
                accent={CABINET_FACE_STROKE}
              />
            )}
            {role ? (
              <ApplianceGlyph
                role={role}
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                stroke="#4b5651"
              />
            ) : (
              !front &&
              segment.kind === "appliance" && (
                <path
                  d={`M ${x + 4} ${y + 4} L ${x + width / 2} ${y + height / 2} L ${x + width - 4} ${y + 4}`}
                  stroke="#a7aaa5"
                  strokeWidth="1"
                  fill="none"
                />
              )
            )}
            {isWindow && (
              <WindowGlyph
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                stroke="#5a8fb8"
              />
            )}
            {roleTag && width >= 26 && (
              <text
                data-role-tag={role}
                x={x + width / 2}
                y={y + height / 2 + 18}
                textAnchor="middle"
                fontFamily="var(--studio-mono)"
                fontSize="8"
                letterSpacing="0.08em"
                fill="#5d6b64"
                clipPath={`url(#${clipId})`}
              >
                {roleTag}
              </text>
            )}
            {segment.kind !== "gap" && (
              <g data-elevation-layer="width-chain">
                <path
                  data-chain-guide={segment.id}
                  d={
                    labelSide === "above"
                      ? `M ${x} ${guideY} V ${guideY + WIDTH_CHAIN_EXTENSION_LENGTH} M ${x} ${guideY} H ${x + width} M ${x + width} ${guideY + WIDTH_CHAIN_EXTENSION_LENGTH} V ${guideY}`
                      : `M ${x} ${guideY} V ${guideY - WIDTH_CHAIN_EXTENSION_LENGTH} M ${x} ${guideY} H ${x + width} M ${x + width} ${guideY - WIDTH_CHAIN_EXTENSION_LENGTH} V ${guideY}`
                  }
                  stroke={DIMENSION_COLOR}
                  strokeWidth={DIMENSION_STROKE_WIDTH}
                  fill="none"
                />
                {lane > 0 && (
                  <line
                    x1={x + width / 2}
                    y1={guideY}
                    x2={x + width / 2}
                    y2={labelY - (labelSide === "below" ? 8 : -3)}
                    stroke={DIMENSION_COLOR}
                    strokeWidth={DIMENSION_STROKE_WIDTH}
                  />
                )}
                <text
                  data-chain-label={segment.id}
                  x={x + width / 2}
                  y={labelY}
                  textAnchor="middle"
                  fontFamily="var(--studio-mono)"
                  fontSize={DIMENSION_FONT_SIZE}
                  fontWeight="bold"
                  stroke="none"
                  fill={DIMENSION_COLOR}
                  className="underline-offset-2 hover:underline"
                >
                  {formatSixteenths(segment.widthSixteenths)}
                </text>
              </g>
            )}
            {breakdownCornerEnd != null && (
              <CornerHostBreakdownDimensions
                segmentId={segment.id}
                x={x}
                width={width}
                tier={segment.tier}
                total={total}
                atLeft={breakdownAtLeft}
                labelSide={labelSide}
              />
            )}
            {lastAbsorbed?.segmentId === segment.id && (
              <g
                key={`absorb-${lastAbsorbed.token}`}
                data-elevation-layer="absorb-pulse"
                className="pointer-events-none"
              >
                <rect
                  x={x}
                  y={y}
                  width={Math.max(8, width)}
                  height={height}
                  fill="#e8b93b"
                  opacity="0"
                >
                  <animate
                    attributeName="opacity"
                    values="0;0.4;0;0.35;0"
                    dur="1.5s"
                    repeatCount="1"
                    fill="freeze"
                  />
                </rect>
                <text
                  data-absorb-delta={lastAbsorbed.deltaSixteenths}
                  x={x + width / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontFamily="var(--studio-mono)"
                  fontSize="11"
                  fontWeight="bold"
                  fill="#9a6b00"
                >
                  {`${lastAbsorbed.deltaSixteenths > 0 ? "+" : "−"}${formatSixteenths(
                    Math.abs(lastAbsorbed.deltaSixteenths)
                  )}`}
                  <animate
                    attributeName="opacity"
                    values="1;1;0"
                    dur="2.2s"
                    repeatCount="1"
                    fill="freeze"
                  />
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

function isMirroredElevationWall(
  wall: ReturnType<typeof findWall>
): boolean {
  // LEFT walls are measured top-to-bottom in plan. From inside the room, that
  // top/back corner appears on the right side of the wall elevation.
  return wall?.sourceWall === "LEFT";
}

function buildCornerReturnTargets(
  model: Round2Model | null,
  wall: ReturnType<typeof findWall>
): Map<string, CornerReturnTarget> {
  const targets = new Map<string, CornerReturnTarget>();
  if (!model || !wall) return targets;
  for (const corner of deriveCorners(model)) {
    if (corner.secondary.id !== wall.id) continue;
    targets.set(corner.id, {
      side: corner.secondaryEnd
    });
  }
  return targets;
}

function insideCornerEnds(
  model: Round2Model | null,
  wall: ReturnType<typeof findWall>
): CornerEnd[] {
  if (!model || !wall) return [];
  const ends = new Set<CornerEnd>();
  for (const corner of deriveCorners(model)) {
    if (corner.primary.id === wall.id) ends.add(corner.primaryEnd);
    if (corner.secondary.id === wall.id) ends.add(corner.secondaryEnd);
  }
  return [...ends];
}

// Corner reservations whose corner is not derivable (e.g. the paired wall is
// missing from the model) still draw the section treatment; they just lose
// the cross-wall jump tag. The corner side falls back to the run end the gap
// actually sits on.
function fallbackCornerReturn(
  index: number,
  segmentCount: number
): CornerReturnTarget {
  return {
    side: index > 0 && index === segmentCount - 1 ? "end" : "start"
  };
}

function cornerReferenceDepthSixteenths(tier: WallSegment["tier"]): number {
  return tier === "upper"
    ? CABINET_STANDARDS.depths.upperSixteenths
    : CABINET_STANDARDS.depths.baseSixteenths;
}

/**
 * A hosted corner cabinet keeps its overall width chain and adds a second,
 * sectional chain for the part crossed by the adjacent wall: upper depth 12″
 * plus its remainder, or base depth 24″ plus its remainder.
 */
function CornerHostBreakdownDimensions({
  segmentId,
  x,
  width,
  tier,
  total,
  atLeft,
  labelSide
}: {
  segmentId: string;
  x: number;
  width: number;
  tier: WallSegment["tier"];
  total: number;
  atLeft: boolean;
  labelSide: "above" | "below";
}) {
  const depthSixteenths = cornerReferenceDepthSixteenths(tier);
  const depthWidth = Math.min(
    width,
    (depthSixteenths / total) * RUN_WIDTH
  );
  const remainderWidth = Math.max(0, width - depthWidth);
  const splitX = atLeft ? x + depthWidth : x + remainderWidth;
  const firstWidth = splitX - x;
  const secondWidth = x + width - splitX;
  const firstDimension = atLeft
    ? depthSixteenths
    : Math.max(0, Math.round((remainderWidth / RUN_WIDTH) * total));
  const secondDimension = atLeft
    ? Math.max(0, Math.round((remainderWidth / RUN_WIDTH) * total))
    : depthSixteenths;
  const guideY =
    labelSide === "above" ? UPPER_CHAIN_LABEL_Y + 27 : FLOOR_Y + 34;
  const labelY = labelSide === "above" ? guideY - 5 : guideY + 10;
  const tickEndY = guideY + (labelSide === "above" ? WIDTH_CHAIN_EXTENSION_LENGTH : -WIDTH_CHAIN_EXTENSION_LENGTH);

  return (
    <g
      data-elevation-layer="corner-breakdown"
      data-corner-breakdown={segmentId}
      stroke={DIMENSION_COLOR}
      fill={DIMENSION_COLOR}
      fontFamily="var(--studio-mono)"
    >
      <path
        data-corner-breakdown-guide={segmentId}
        d={`M ${x} ${guideY} V ${tickEndY} M ${x} ${guideY} H ${splitX} M ${splitX} ${guideY} V ${tickEndY} M ${splitX} ${guideY} H ${x + width} M ${x + width} ${guideY} V ${tickEndY}`}
        strokeWidth={DIMENSION_STROKE_WIDTH}
        fill="none"
      />
      {firstWidth > 0 && (
        <text
          data-corner-breakdown-label="first"
          x={x + firstWidth / 2}
          y={labelY}
          textAnchor="middle"
          fontSize={DIMENSION_FONT_SIZE}
          fontWeight="bold"
          stroke="none"
        >
          {formatSixteenths(firstDimension)}
        </text>
      )}
      {secondWidth > 0 && (
        <text
          data-corner-breakdown-label="second"
          x={splitX + secondWidth / 2}
          y={labelY}
          textAnchor="middle"
          fontSize={DIMENSION_FONT_SIZE}
          fontWeight="bold"
          stroke="none"
        >
          {formatSixteenths(secondDimension)}
        </text>
      )}
    </g>
  );
}

/** Corners hosted by this wall (it carries the corner cabinet itself). */
function buildCornerHostSides(
  model: Round2Model | null,
  wall: ReturnType<typeof findWall>
): Map<string, CornerEnd> {
  const sides = new Map<string, CornerEnd>();
  if (!model || !wall) return sides;
  for (const corner of deriveCorners(model)) {
    if (corner.primary.id === wall.id) sides.set(corner.id, corner.primaryEnd);
  }
  return sides;
}

/**
 * On the hosting wall the adjacent run also crosses the picture plane at the
 * corner: its side elevation overlaps the first base-depth (24″) / upper-depth
 * (12″) of the corner cabinet. Drawn wall-level, translucent and inert, so the
 * cabinet underneath stays selectable.
 */
function CornerSideProfile({
  atLeft,
  layout,
  pxPerSixteenth,
  hatchPatternId
}: {
  atLeft: boolean;
  layout: VerticalLayout;
  pxPerSixteenth: number;
  hatchPatternId?: string;
}) {
  const depths = CABINET_STANDARDS.depths;
  const baseWidth = depths.baseSixteenths * pxPerSixteenth;
  const upperWidth = depths.upperSixteenths * pxPerSixteenth;
  const baseX = atLeft ? RUN_LEFT : RUN_LEFT + RUN_WIDTH - baseWidth;
  const upperX = atLeft ? RUN_LEFT : RUN_LEFT + RUN_WIDTH - upperWidth;
  const counterThickness = Math.max(
    3,
    COUNTER_THICKNESS_SIXTEENTHS * layout.scale
  );
  const counterOverhang = COUNTER_THICKNESS_SIXTEENTHS * pxPerSixteenth;
  const counterX = atLeft ? baseX : baseX - counterOverhang;
  const toeHeight = Math.max(6, TOE_KICK_HEIGHT_SIXTEENTHS * layout.scale);
  const toeDepth = Math.min(
    baseWidth / 3,
    TOE_KICK_DEPTH_SIXTEENTHS * pxPerSixteenth
  );
  const faceTop = layout.baseTop + counterThickness;
  const profileFill = hatchPatternId ? `url(#${hatchPatternId})` : "none";
  const basePath = atLeft
    ? `M ${baseX} ${faceTop} H ${baseX + baseWidth} V ${FLOOR_Y - toeHeight} H ${baseX + baseWidth - toeDepth} V ${FLOOR_Y} H ${baseX} Z`
    : `M ${baseX + baseWidth} ${faceTop} H ${baseX} V ${FLOOR_Y - toeHeight} H ${baseX + toeDepth} V ${FLOOR_Y} H ${baseX + baseWidth} Z`;
  return (
    <g
      data-elevation-layer="corner-side-profile"
      className="pointer-events-none"
    >
      <rect
        data-corner-side-profile="counter"
        x={counterX}
        y={layout.baseTop}
        width={baseWidth + counterOverhang}
        height={counterThickness}
        fill={COUNTER_SECTION_FILL}
        stroke="#2c2c2c"
        strokeWidth="1"
      />
      <path
        data-corner-side-profile="base"
        d={basePath}
        fill={profileFill}
        stroke={CORNER_SECTION_COLOR}
        strokeWidth="1.5"
      />
      <rect
        data-corner-side-profile="upper"
        x={upperX}
        y={layout.upperTop}
        width={upperWidth}
        height={layout.upperBottom - layout.upperTop}
        fill={profileFill}
        stroke={CORNER_SECTION_COLOR}
        strokeWidth="1.5"
      />
    </g>
  );
}

/**
 * Corner cabinet front on its hosting wall: a bi-fold door glyph hinged at
 * the adjacent run's side profile, folding into the visible remainder.
 */
function CornerFrontFace({
  x,
  y,
  width,
  height,
  overlap,
  atLeft,
  front,
  accent
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  overlap: number;
  atLeft: boolean;
  front: ResolvedFront;
  accent: string;
}) {
  const hingeX = atLeft ? x + overlap : x + width - overlap;
  const farX = atLeft ? x + width - 4 : x + 4;
  const foldX = (hingeX + farX) / 2;
  const visible = Math.max(0, width - overlap);
  return (
    <g data-face="corner-front" stroke={accent} strokeWidth="1" fill="none">
      {visible > 12 && (
        <>
          <path
            d={`M ${hingeX + (atLeft ? 2 : -2)} ${y + 4} L ${farX} ${y + height / 2} L ${hingeX + (atLeft ? 2 : -2)} ${y + height - 4}`}
          />
          <line x1={foldX} y1={y + 6} x2={foldX} y2={y + height - 6} />
        </>
      )}
      <AccessoryTag x={atLeft ? hingeX : x} y={y} front={front} />
    </g>
  );
}

/**
 * A corner cabinet's footprint on the adjacent wall, drawn to section
 * conventions instead of an empty reservation box: the run's side profile is
 * cut by the picture plane (hatch + toe-kick notch), the counter reads as a
 * poché slab, and the carcass hidden behind the section is dashed.
 */
function CornerReturnSection({
  x,
  y,
  width,
  height,
  tier,
  layout,
  pxPerSixteenth,
  cornerAtLeft,
  selected,
  hatchPatternId
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  tier: WallSegment["tier"];
  layout: VerticalLayout;
  pxPerSixteenth: number;
  cornerAtLeft: boolean;
  selected: boolean;
  hatchPatternId?: string;
}) {
  const depths = CABINET_STANDARDS.depths;
  const isBase = tier !== "upper";
  const depthSixteenths = isBase ? depths.baseSixteenths : depths.upperSixteenths;
  const profileWidth = Math.min(width, depthSixteenths * pxPerSixteenth);
  const profileX = cornerAtLeft ? x : x + width - profileWidth;
  const counterThickness = isBase
    ? Math.max(3, COUNTER_THICKNESS_SIXTEENTHS * layout.scale)
    : 0;
  const toeHeight = Math.max(6, TOE_KICK_HEIGHT_SIXTEENTHS * layout.scale);
  const toeDepth = Math.min(
    profileWidth / 3,
    TOE_KICK_DEPTH_SIXTEENTHS * pxPerSixteenth
  );
  const faceTop = y + counterThickness;
  const floor = y + height;
  const profileFill = hatchPatternId
    ? `url(#${hatchPatternId})`
    : CORNER_RETURN_FILL;
  const visibleFaceX = cornerAtLeft ? x + profileWidth : x;
  const visibleFaceWidth = Math.max(0, width - profileWidth);
  // The toe-kick notch sits at the run's front edge — the side away from the
  // corner — so the section profile reads with the cabinet facing the room.
  const profilePath = cornerAtLeft
    ? `M ${profileX} ${faceTop} H ${profileX + profileWidth} V ${floor - toeHeight} H ${profileX + profileWidth - toeDepth} V ${floor} H ${profileX} Z`
    : `M ${profileX + profileWidth} ${faceTop} H ${profileX} V ${floor - toeHeight} H ${profileX + toeDepth} V ${floor} H ${profileX + profileWidth} Z`;
  return (
    <g data-face="corner-return">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={CORNER_RETURN_FILL}
        fillOpacity={1}
        stroke={selected ? "#079ca5" : HIDDEN_LINE_COLOR}
        strokeWidth={selected ? 3 : 1.2}
        strokeDasharray={selected ? undefined : "5 4"}
      />
      {visibleFaceWidth > 0 && (
        <rect
          data-corner-return-visible-face="true"
          x={visibleFaceX}
          y={faceTop}
          width={visibleFaceWidth}
          height={floor - faceTop}
          fill="#fbfbf8"
          stroke="#2c2c2c"
          strokeWidth="1.5"
        />
      )}
      {isBase ? (
        <>
          <rect
            data-corner-return-counter="true"
            x={x}
            y={y}
            width={width}
            height={counterThickness}
            fill={COUNTER_SECTION_FILL}
            stroke="#2c2c2c"
            strokeWidth="1"
          />
          <path
            data-corner-return-profile="true"
            d={profilePath}
            fill={profileFill}
            stroke={CORNER_SECTION_COLOR}
            strokeWidth="1.5"
          />
        </>
      ) : (
        <rect
          data-corner-return-profile="true"
          x={profileX}
          y={y}
          width={profileWidth}
          height={height}
          fill={profileFill}
          stroke={CORNER_SECTION_COLOR}
          strokeWidth="1.5"
        />
      )}
    </g>
  );
}

function isFillerLikeSegment(segment: WallSegment): boolean {
  const label = (segment.code ?? segment.label).trim();
  return (
    segment.kind === "filler" ||
    /^F\d/i.test(label) ||
    segment.widthSixteenths <= CABINET_STANDARDS.filler.preferredSixteenths
  );
}

function sanitizeSvgId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * Cabinet face from the resolved front: drawer stacks render proportional
 * splits, doors render their V swing lines, accessories tag the corner.
 */
function SegmentFace({
  x,
  y,
  width,
  height,
  front,
  accent,
  role
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  front: ResolvedFront;
  accent: string;
  role?: string | null;
}) {
  let faceY = y;
  let faceHeight = height;
  let extraLines = null;

  if (role === "hood") {
    faceHeight = height - Math.min(height * 0.3, 15);
  } else if (role === "sink") {
    const falseFrontHeight = Math.min(height * 0.2, 18);
    faceY = y + falseFrontHeight;
    faceHeight = height - falseFrontHeight;
    extraLines = (
      <line x1={x + 3} y1={faceY} x2={x + width - 3} y2={faceY} stroke={accent} strokeWidth="1" fill="none" />
    );
  }
  if (front.drawerStack.length > 0) {
    const totalUnits = front.drawerStack.reduce((sum, unit) => sum + unit, 0);
    let offset = 0;
    return (
      <g data-face="drawers" stroke={accent} strokeWidth="1" fill="none">
        {extraLines}
        {front.drawerStack.map((unit, index) => {
          offset += unit;
          const lineY = faceY + (offset / totalUnits) * faceHeight;
          return (
            <g key={index}>
              {index < front.drawerStack.length - 1 && (
                <line x1={x + 3} y1={lineY} x2={x + width - 3} y2={lineY} />
              )}
              <line
                x1={x + width / 2 - Math.min(9, width / 4)}
                y1={lineY - faceHeight * (unit / totalUnits) / 2}
                x2={x + width / 2 + Math.min(9, width / 4)}
                y2={lineY - faceHeight * (unit / totalUnits) / 2}
                strokeWidth="2"
              />
            </g>
          );
        })}
      </g>
    );
  }

  if (front.doorCount === 2) {
    return (
      <g data-face="double-door" stroke={accent} strokeWidth="1" fill="none">
        {extraLines}
        <line x1={x + width / 2} y1={faceY + 3} x2={x + width / 2} y2={faceY + faceHeight - 3} />
        <path d={`M ${x + width / 2 - 2} ${faceY + 3} L ${x + 3} ${faceY + faceHeight / 2} L ${x + width / 2 - 2} ${faceY + faceHeight - 3}`} />
        <path d={`M ${x + width / 2 + 2} ${faceY + 3} L ${x + width - 3} ${faceY + faceHeight / 2} L ${x + width / 2 + 2} ${faceY + faceHeight - 3}`} />
        <AccessoryTag x={x} y={faceY} front={front} />
      </g>
    );
  }

  if (front.doorCount === 1) {
    return (
      <g data-face="single-door" stroke={accent} strokeWidth="1" fill="none">
        {extraLines}
        <path d={`M ${x + 4} ${faceY + faceHeight - 4} L ${x + width / 2} ${faceY + faceHeight / 2} L ${x + width - 4} ${faceY + faceHeight - 4}`} />
        <AccessoryTag x={x} y={faceY} front={front} />
      </g>
    );
  }

  return (
    <g>
      {extraLines}
      <AccessoryTag x={x} y={faceY} front={front} />
    </g>
  );
}

const ACCESSORY_TAGS: Record<string, string> = {
  trashPullout: "TP",
  spicePullout: "SP",
  lazySusan: "LS",
  magicCorner: "MC",
  blindCornerPullOut: "BCP",
  cornerPullOutShelves: "CPS"
};

function AccessoryTag({
  x,
  y,
  front
}: {
  x: number;
  y: number;
  front: ResolvedFront;
}) {
  if (front.accessories.length === 0) return null;
  return (
    <text
      x={x + 4}
      y={y + 11}
      fontFamily="var(--studio-mono)"
      fontSize="7"
      fill="#7a5b00"
      stroke="none"
    >
      {front.accessories.map((item) => ACCESSORY_TAGS[item] ?? item).join("·")}
    </text>
  );
}

const CARD_CHIP_CLASS =
  "h-7 rounded-[7px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted outline-none transition-colors hover:border-studio-ink aria-pressed:border-studio-ink aria-pressed:bg-studio-ink aria-pressed:text-white";

const FACE_OPTIONS: {
  label: string;
  doorCount: 0 | 1 | 2;
  drawerStack: number[];
}[] = [
  { label: "1 door", doorCount: 1, drawerStack: [] },
  { label: "2 doors", doorCount: 2, drawerStack: [] },
  { label: "2 drawers", doorCount: 0, drawerStack: [1, 1] },
  { label: "3 drawers", doorCount: 0, drawerStack: [1, 1, 1] }
];

const STANDARD_ACCESSORY_OPTIONS: FrontAccessory[] = [
  "trashPullout",
  "spicePullout"
];

const CORNER_ACCESSORY_OPTIONS: FrontAccessory[] = [
  "lazySusan",
  "magicCorner",
  "blindCornerPullOut",
  "cornerPullOutShelves"
];

export const KIND_OPTIONS: { value: CabinetKind; label: string }[] = [
  { value: "base", label: "Base" },
  { value: "tall", label: "Tall" }
];

export function canEditSegmentKind(segment: WallSegment): boolean {
  return segment.kind === "cabinet" && segment.tier !== "upper";
}

export function canOpenSegmentEditor(segment: WallSegment): boolean {
  if (segment.kind === "opening") return false;
  if (segment.kind === "gap") return Boolean(segment.sourceCornerId);
  return true;
}

export function accessoryOptionsForSegment(
  segment: WallSegment
): FrontAccessory[] {
  return segment.cabinetKind === "corner"
    ? [...CORNER_ACCESSORY_OPTIONS]
    : [...STANDARD_ACCESSORY_OPTIONS];
}

function CardSectionLabel({ children }: { children: string }) {
  return (
    <span className="mt-2.5 block font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
      {children}
    </span>
  );
}

/**
 * The single editing entry point: clicking a cabinet or its chain label opens
 * this card. Cabinets take width steps / custom widths (STEP_CABINET_WIDTH,
 * absorbed by a same-zone filler), fronts and kinds; fillers are remainder
 * space, so they expose placement only (SET_FILLER_PLACEMENT) — never a width.
 */
function SegmentEditorCard({
  segment,
  designIntent,
  dispatch,
  onClose
}: {
  segment: WallSegment;
  designIntent?: Round2DesignIntent;
  dispatch: Dispatch<Round2PrototypeAction>;
  onClose: () => void;
}) {
  const resizable = segment.kind === "cabinet" || segment.kind === "appliance";
  const isFiller = segment.kind === "filler";
  const front = resolveSegmentFront(segment, designIntent);
  const cornerIntentKey = cornerIntentKeyForSegment(segment);

  return (
    <div
      data-testid="segment-editor-card"
      className="absolute bottom-3 left-1/2 z-20 max-h-[calc(100%-84px)] w-[320px] -translate-x-1/2 overflow-y-auto rounded-[12px] border border-studio-line bg-white p-3 shadow-[0_18px_42px_-18px_rgba(20,20,26,0.4)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold">
          {segment.code ?? segment.label} ·{" "}
          {formatSixteenths(segment.widthSixteenths)}
        </span>
        <div className="flex items-center gap-1.5">
          {isFiller && (
            <span className="rounded-full bg-[#f6ead4] px-2 py-0.5 font-mono text-[7px] tracking-[0.08em] text-[#815416]">
              REMAINDER · AUTO
            </span>
          )}
          <button
            type="button"
            aria-label="Close segment editor"
            onClick={onClose}
            className="rounded px-1.5 font-mono text-[11px] text-studio-muted hover:bg-black/5"
          >
            ✕
          </button>
        </div>
      </div>

      {cornerIntentKey && (
        <CornerSetupControls
          intentKey={cornerIntentKey}
          segment={segment}
          designIntent={designIntent}
          dispatch={dispatch}
        />
      )}

      {resizable && (
        <>
          <CardSectionLabel>WIDTH</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-5 gap-1">
            {standardWidthOptionsSixteenths().map((width) => (
              <button
                key={width}
                type="button"
                aria-pressed={segment.widthSixteenths === width}
                onClick={() =>
                  dispatch({
                    type: "STEP_CABINET_WIDTH",
                    objectId: segment.id,
                    widthSixteenths: width
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {width / 16}″
              </button>
            ))}
          </div>
          <InchField
            value={segment.widthSixteenths}
            onChange={(value) => {
              if (value != null && value > 0) {
                dispatch({
                  type: "STEP_CABINET_WIDTH",
                  objectId: segment.id,
                  widthSixteenths: value
                });
              }
            }}
            ariaLabel={`Custom width for ${segment.code ?? segment.label}`}
          />
        </>
      )}

      {front && (
        <>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
              FRONT
            </span>
            <span className="font-mono text-[8px] text-studio-muted">
              {describeFront(front)}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {FACE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={
                  front.doorCount === option.doorCount &&
                  front.drawerStack.length === option.drawerStack.length
                }
                onClick={() =>
                  dispatch({
                    type: "SET_SEGMENT_FRONT",
                    objectId: segment.id,
                    front: {
                      doorCount: option.doorCount,
                      drawerStack: option.drawerStack
                    }
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {(["handle", "fingerPull"] as const).map((hardware) => (
              <button
                key={hardware}
                type="button"
                aria-pressed={front.hardware === hardware}
                onClick={() =>
                  dispatch({
                    type: "SET_SEGMENT_FRONT",
                    objectId: segment.id,
                    front: { hardware }
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {hardware === "handle" ? "Handle" : "Finger pull"}
              </button>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {accessoryOptionsForSegment(segment).map((accessory) => {
              const active = front.accessories.includes(accessory);
              return (
                <button
                  key={accessory}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    dispatch({
                      type: "SET_SEGMENT_FRONT",
                      objectId: segment.id,
                      front: {
                        accessories: active
                          ? front.accessories.filter(
                              (item) => item !== accessory
                            )
                          : [...front.accessories, accessory]
                      }
                    })
                  }
                  className={CARD_CHIP_CLASS}
                >
                  {ACCESSORY_LABELS[accessory]}
                </button>
              );
            })}
          </div>
        </>
      )}

      {canEditSegmentKind(segment) && (
        <>
          <CardSectionLabel>KIND</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={segment.cabinetKind === option.value}
                onClick={() =>
                  dispatch({
                    type: "SET_SEGMENT_KIND",
                    objectId: segment.id,
                    cabinetKind: option.value
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}

      {resizable && (
        <>
          <CardSectionLabel>SLIDE GROUP</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "NUDGE_GROUP",
                  objectId: segment.id,
                  direction: "left"
                })
              }
              className={CARD_CHIP_CLASS}
            >
              ← 1/16″
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "NUDGE_GROUP",
                  objectId: segment.id,
                  direction: "right"
                })
              }
              className={CARD_CHIP_CLASS}
            >
              1/16″ →
            </button>
          </div>
        </>
      )}

      {isFiller && (
        <>
          <p className="mt-2 text-[9.5px] leading-4 text-studio-muted">
            Remainder space: its width is wall length minus the cabinets and
            settles automatically. Choose where it sits instead.
          </p>
          <CardSectionLabel>PLACEMENT</CardSectionLabel>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {(
              [
                { placement: "start", label: "◀ Left end" },
                { placement: "split", label: "Split ends" },
                { placement: "end", label: "Right end ▶" }
              ] as const
            ).map((option) => (
              <button
                key={option.placement}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_FILLER_PLACEMENT",
                    objectId: segment.id,
                    placement: option.placement
                  })
                }
                className={CARD_CHIP_CLASS}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const CORNER_STRATEGY_OPTIONS: { value: CornerStrategy; label: string }[] = [
  { value: "lazySusan", label: "Lazy Susan" },
  { value: "blindBase", label: "Blind base" },
  { value: "magicCorner", label: "Magic Corner" },
  { value: "blindCornerPullOut", label: "Blind pull-out" },
  { value: "cornerPullOutShelves", label: "Pull-out shelves" }
];

function CornerSetupControls({
  intentKey,
  segment,
  designIntent,
  dispatch
}: {
  intentKey: string;
  segment: WallSegment;
  designIntent?: Round2DesignIntent;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const selected =
    designIntent?.answers[intentKey] ?? inferCornerStrategy(segment);
  return (
    <>
      <CardSectionLabel>CORNER SETUP</CardSectionLabel>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {CORNER_STRATEGY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected === option.value}
            onClick={() =>
              dispatch({
                type: "SET_DESIGN_INTENT",
                key: intentKey,
                value: option.value
              })
            }
            className={CARD_CHIP_CLASS}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}

function cornerIntentKeyForSegment(segment: WallSegment): string | null {
  return segment.sourceCornerId ? `corner.${segment.sourceCornerId}.strategy` : null;
}

function inferCornerStrategy(segment: WallSegment): CornerStrategy {
  const accessories = segment.front?.accessories ?? [];
  if (accessories.includes("magicCorner")) return "magicCorner";
  if (accessories.includes("blindCornerPullOut")) return "blindCornerPullOut";
  if (accessories.includes("cornerPullOutShelves")) return "cornerPullOutShelves";
  if ((segment.code ?? segment.label).startsWith("LS")) return "lazySusan";
  if ((segment.code ?? segment.label).startsWith("BB")) return "blindBase";
  return "lazySusan";
}
