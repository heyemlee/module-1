"use client";

import { useId, useState, type Dispatch } from "react";
import { cn } from "@/lib/utils";
import {
  findWall,
  formatSixteenths,
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
import { resolveSegmentFront, type ResolvedFront } from "../model/front";
import type { Round2DesignIntent } from "../model/design-intent";
import type { Round2PrototypeAction } from "../round2-types";
import { InchField } from "../measurement/inch-field";

// Elevation canvas: the floor line and the ceiling span are fixed in pixels;
// everything vertical in between scales from the model height profile.
const RUN_LEFT = 70;
const RUN_WIDTH = 500;
const FLOOR_Y = 326;
const CEILING_Y = 62;
const MIN_LABEL_PX = 34;
const LANE_STEP = 11;
const IN_BOX_LABEL_CHAR_PX = 6;
const IN_BOX_LABEL_PADDING_PX = 2;
const DIMENSION_COLOR = "#079ca5";
const DIMENSION_FONT_SIZE = 11;
const DIMENSION_STROKE_WIDTH = 2;
const OVERALL_DIMENSION_LABEL_Y = 19;
const OVERALL_DIMENSION_GUIDE_Y = 29;
const UPPER_CHAIN_LABEL_Y = CEILING_Y - 20;
const CABINET_FACE_STROKE = "#a7aaa5";
const TALL_HEIGHT_CHAIN_X = 32;
const TALL_HEIGHT_LABEL_X = 20;

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
  canEdit = false,
  onSelect,
  onSelectWall,
  dispatch
}: {
  wallId: WallId | null;
  model: Round2Model | null;
  designIntent?: Round2DesignIntent;
  selectedObjectId: string | null;
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
  const editingSegment =
    wall?.segments.find((segment) => segment.id === editingId) ?? null;

  const openEditor = (segment: WallSegment) => {
    onSelect(segment.id, wall?.id ?? "");
    if (!canEdit || !dispatch) return;
    if (segment.kind === "opening" || segment.kind === "gap") return;
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
        viewBox="0 0 640 380"
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={wall ? `Wall ${wall.label} cabinet elevation` : "Cabinet elevation"}
        className="relative z-10 h-[calc(100%-68px)] min-h-[360px] w-full"
      >
        <g data-elevation-layer="dimensions" stroke={DIMENSION_COLOR} fill={DIMENSION_COLOR} fontFamily="var(--studio-mono)">
          <path
            data-chain-guide="overall"
            d={`M 70 ${OVERALL_DIMENSION_GUIDE_Y - 6} V ${OVERALL_DIMENSION_GUIDE_Y + 6} M 570 ${OVERALL_DIMENSION_GUIDE_Y - 6} V ${OVERALL_DIMENSION_GUIDE_Y + 6} M 70 ${OVERALL_DIMENSION_GUIDE_Y} H 570`}
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
              onActivate={openEditor}
            />
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
        <WidthChainEditor
          segment={editingSegment}
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
  onActivate
}: {
  fixedPoints: Round2FixedPoint[];
  segments: WallSegment[];
  total: number;
  layout: VerticalLayout;
  designIntent?: Round2DesignIntent;
  labelSide: "above" | "below";
  selectedObjectId: string | null;
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
        const x = RUN_LEFT + cursor;
        cursor += width;
        const { y, height } = segmentBox(segment, layout);
        const selected = selectedObjectId === segment.id;
        const fillerLike = isFillerLikeSegment(segment);
        const front = fillerLike ? null : resolveSegmentFront(segment, designIntent);
        const role = resolveSegmentRole(segment, { fixedPoints });
        const roleTag = role ? SEGMENT_ROLE_TAGS[role] : null;
        const isWindow =
          segment.kind === "opening" &&
          fixedPoints.find((point) => point.id === segment.sourceFixedPointId)
            ?.type === "window";
        const lane = 0;
        const displayLabel = isWindow ? null : segmentDisplayLabel(segment, width);
        const clipId = `${labelClipIdPrefix}-${sanitizeSvgId(segment.id)}-label`;
        const labelY =
          labelSide === "below"
            ? FLOOR_Y + 22 + lane * LANE_STEP
            : UPPER_CHAIN_LABEL_Y - lane * LANE_STEP;
        const guideY =
          labelSide === "below" ? FLOOR_Y + 12 : labelY + 5;
        const isGapLabel = segment.kind === "gap";
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
            {front && (
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
            {displayLabel && (
              <text
                data-display-label={displayLabel}
                x={x + width / 2}
                y={y + height / 2 + (isGapLabel ? 3 : 5)}
                textAnchor="middle"
                fontFamily="var(--studio-mono)"
                fontSize={isGapLabel ? "8" : "13"}
                letterSpacing={isGapLabel ? "0.08em" : undefined}
                fill={
                  isGapLabel
                    ? "#5d6b64"
                    : fillerLike
                      ? "#7a5b00"
                      : "#e12821"
                }
                clipPath={`url(#${clipId})`}
              >
                {displayLabel}
              </text>
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
                      ? `M ${x} ${guideY} V ${guideY + 4} M ${x} ${guideY} H ${x + width} M ${x + width} ${guideY + 4} V ${guideY}`
                      : `M ${x} ${guideY} V ${guideY - 4} M ${x} ${guideY} H ${x + width} M ${x + width} ${guideY - 4} V ${guideY}`
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
          </g>
        );
      })}
    </g>
  );
}

function segmentDisplayLabel(
  segment: WallSegment,
  widthPx: number
): string | null {
  const label = segment.code ?? segment.label;
  const candidates = compactLabelCandidates(label);
  const usableWidth = Math.max(0, widthPx - IN_BOX_LABEL_PADDING_PX * 2);
  const fitting = candidates.find(
    (candidate) => candidate.length * IN_BOX_LABEL_CHAR_PX <= usableWidth
  );

  if (fitting) return fitting;
  const fallback = candidates.at(-1) ?? label;
  return fallback.length <= 3 && widthPx >= 18 ? fallback : null;
}

function compactLabelCandidates(label: string): string[] {
  const normalized = label.trim().toLowerCase();
  if (normalized === "corner clearance") return ["CLEAR", "CLR"];
  if (normalized === "dead corner") return ["DEAD", "DC"];
  if (normalized === "blind corner") return ["BLIND", "BC"];
  return [label];
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
  lazySusan: "LS"
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

/**
 * The width chain is the input: clicking a chain label opens this editor.
 * Everything maps onto the existing constrained actions — width steps and
 * custom widths via STEP_CABINET_WIDTH, 1/16″ nudges via NUDGE_GROUP and
 * filler repositioning via MOVE_FILLER_END.
 */
function WidthChainEditor({
  segment,
  dispatch,
  onClose
}: {
  segment: WallSegment;
  dispatch: Dispatch<Round2PrototypeAction>;
  onClose: () => void;
}) {
  const resizable = segment.kind === "cabinet" || segment.kind === "appliance";

  return (
    <div
      data-testid="width-chain-editor"
      className="absolute bottom-3 left-1/2 z-20 w-[300px] -translate-x-1/2 rounded-[12px] border border-studio-line bg-white p-3 shadow-[0_18px_42px_-18px_rgba(20,20,26,0.4)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold">
          {segment.code ?? segment.label} · {formatSixteenths(segment.widthSixteenths)}
        </span>
        <button
          type="button"
          aria-label="Close width editor"
          onClick={onClose}
          className="rounded px-1.5 font-mono text-[11px] text-studio-muted hover:bg-black/5"
        >
          ✕
        </button>
      </div>

      {resizable && (
        <>
          <div className="mt-2 grid grid-cols-5 gap-1">
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
                className="h-7 rounded-[7px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted outline-none transition-colors hover:border-studio-ink aria-pressed:border-studio-ink aria-pressed:bg-studio-ink aria-pressed:text-white"
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

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "NUDGE_GROUP",
              objectId: segment.id,
              direction: "left"
            })
          }
          className="h-7 rounded-[7px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted hover:border-studio-ink"
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
          className="h-7 rounded-[7px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted hover:border-studio-ink"
        >
          1/16″ →
        </button>
      </div>

      {segment.kind === "filler" && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "MOVE_FILLER_END",
                objectId: segment.id,
                end: "start"
              })
            }
            className="h-7 rounded-[7px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted hover:border-studio-ink"
          >
            Move start
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "MOVE_FILLER_END",
                objectId: segment.id,
                end: "end"
              })
            }
            className="h-7 rounded-[7px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted hover:border-studio-ink"
          >
            Move end
          </button>
        </div>
      )}
    </div>
  );
}
