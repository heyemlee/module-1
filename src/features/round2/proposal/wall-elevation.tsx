"use client";

import { useState, type Dispatch } from "react";
import { cn } from "@/lib/utils";
import {
  findWall,
  formatSixteenths,
  type Round2HeightProfile,
  type Round2Model,
  type WallId,
  type WallSegment
} from "../model/round2-model";
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
const FLOOR_Y = 306;
const CEILING_Y = 42;
const MIN_LABEL_PX = 34;
const LANE_STEP = 11;

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
  if (segment.kind === "filler") return "#f0dda0";
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
      <div className="pointer-events-none absolute inset-0 opacity-100 [background-image:linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative z-10 flex items-center justify-between border-b border-studio-line/40 px-4 py-3">
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
        className="h-[calc(100%-68px)] min-h-[360px] w-full"
      >
        <g data-elevation-layer="dimensions" stroke="#079ca5" fill="#079ca5" fontFamily="var(--studio-mono)">
          <path d="M 70 22 V 34 M 570 22 V 34 M 70 28 H 570" strokeWidth="1" />
          <text x="320" y="17" textAnchor="middle" fontSize="11">
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
              wallId={wall.id}
              segments={upper}
              total={total}
              layout={layout}
              designIntent={designIntent}
              labelSide="above"
              selectedObjectId={selectedObjectId}
              onActivate={openEditor}
            />
            <ElevationRun
              wallId={wall.id}
              segments={base}
              total={total}
              layout={layout}
              designIntent={designIntent}
              labelSide="below"
              selectedObjectId={selectedObjectId}
              onActivate={openEditor}
            />
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
        strokeWidth="1"
      />
      <text
        x="611"
        y={(CEILING_Y + FLOOR_Y) / 2}
        textAnchor="middle"
        fontSize="10"
        transform={`rotate(90 611 ${(CEILING_Y + FLOOR_Y) / 2})`}
      >
        {formatSixteenths(model?.ceilingHeightSixteenths)}
      </text>
      <path
        d={`M 58 ${layout.baseTop} H 66 M 58 ${FLOOR_Y} H 66 M 62 ${layout.baseTop} V ${FLOOR_Y}`}
        strokeWidth="1"
      />
      <text
        x="49"
        y={(layout.baseTop + FLOOR_Y) / 2}
        textAnchor="middle"
        fontSize="10"
        transform={`rotate(-90 49 ${(layout.baseTop + FLOOR_Y) / 2})`}
      >
        {formatSixteenths(profile.counterSixteenths)}
      </text>
      <path
        d={`M 58 ${layout.upperTop} H 66 M 58 ${layout.upperBottom} H 66 M 62 ${layout.upperTop} V ${layout.upperBottom}`}
        strokeWidth="1"
      />
      <text
        x="49"
        y={(layout.upperTop + layout.upperBottom) / 2}
        textAnchor="middle"
        fontSize="10"
        transform={`rotate(-90 49 ${(layout.upperTop + layout.upperBottom) / 2})`}
      >
        {formatSixteenths(profile.upperHeightSixteenths)}
      </text>
    </g>
  );
}

function ElevationRun({
  wallId,
  segments,
  total,
  layout,
  designIntent,
  labelSide,
  selectedObjectId,
  onActivate
}: {
  wallId: WallId;
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
  let cursor = 0;

  return (
    <g>
      {segments.map((segment, index) => {
        const width = widthsPx[index];
        const x = RUN_LEFT + cursor;
        cursor += width;
        const { y, height } = segmentBox(segment, layout);
        const selected = selectedObjectId === segment.id;
        const lane = lanes[index];
        const labelY =
          labelSide === "below"
            ? FLOOR_Y + 16 + lane * LANE_STEP
            : Math.max(56, layout.upperTop - 10 - lane * LANE_STEP);
        const front = resolveSegmentFront(segment, designIntent);
        return (
          <g
            key={segment.id}
            data-segment-id={segment.id}
            data-cabinet-id={segment.id}
            data-selected={selected}
            onClick={() => onActivate(segment)}
            className="cursor-pointer"
          >
            <rect
              x={x}
              y={y}
              width={Math.max(8, width)}
              height={height}
              fill={segmentFill(segment)}
              stroke={selected ? "#079ca5" : "#2c2c2c"}
              strokeWidth={selected ? 3 : 1.5}
            />
            {front ? (
              <SegmentFace
                x={x}
                y={y}
                width={Math.max(8, width)}
                height={height}
                front={front}
                accent={segment.tier === "upper" ? "#e12821" : "#a7aaa5"}
              />
            ) : (
              segment.kind === "appliance" && (
                <path
                  d={`M ${x + 4} ${y + 4} L ${x + width / 2} ${y + height / 2} L ${x + width - 4} ${y + 4}`}
                  stroke="#a7aaa5"
                  strokeWidth="1"
                  fill="none"
                />
              )
            )}
            <text
              x={x + width / 2}
              y={y + height / 2 + 5}
              textAnchor="middle"
              fontFamily="var(--studio-mono)"
              fontSize="13"
              fill={segment.kind === "filler" ? "#7a5b00" : "#e12821"}
            >
              {segment.code ?? segment.label}
            </text>
            {segment.kind !== "gap" && (
              <g data-elevation-layer="width-chain">
                {lane > 0 && (
                  <line
                    x1={x + width / 2}
                    y1={labelSide === "below" ? FLOOR_Y + 4 : layout.upperTop - 2}
                    x2={x + width / 2}
                    y2={labelY - (labelSide === "below" ? 8 : -3)}
                    stroke="#079ca5"
                    strokeWidth="0.6"
                  />
                )}
                <text
                  data-chain-label={segment.id}
                  x={x + width / 2}
                  y={labelY}
                  textAnchor="middle"
                  fontFamily="var(--studio-mono)"
                  fontSize="9"
                  fill="#079ca5"
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
  accent
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  front: ResolvedFront;
  accent: string;
}) {
  if (front.drawerStack.length > 0) {
    const totalUnits = front.drawerStack.reduce((sum, unit) => sum + unit, 0);
    let offset = 0;
    return (
      <g data-face="drawers" stroke={accent} strokeWidth="1" fill="none">
        {front.drawerStack.map((unit, index) => {
          offset += unit;
          const lineY = y + (offset / totalUnits) * height;
          return (
            <g key={index}>
              {index < front.drawerStack.length - 1 && (
                <line x1={x + 3} y1={lineY} x2={x + width - 3} y2={lineY} />
              )}
              <line
                x1={x + width / 2 - Math.min(9, width / 4)}
                y1={lineY - height * (unit / totalUnits) / 2}
                x2={x + width / 2 + Math.min(9, width / 4)}
                y2={lineY - height * (unit / totalUnits) / 2}
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
        <line x1={x + width / 2} y1={y + 3} x2={x + width / 2} y2={y + height - 3} />
        <path d={`M ${x + 3} ${y + 3} L ${x + width / 2 - 2} ${y + height / 2} L ${x + 3} ${y + height - 3}`} />
        <path d={`M ${x + width - 3} ${y + 3} L ${x + width / 2 + 2} ${y + height / 2} L ${x + width - 3} ${y + height - 3}`} />
        <AccessoryTag x={x} y={y} front={front} />
      </g>
    );
  }

  if (front.doorCount === 1) {
    return (
      <g data-face="single-door" stroke={accent} strokeWidth="1" fill="none">
        <path d={`M ${x + 4} ${y + 4} L ${x + width / 2} ${y + height / 2} L ${x + width - 4} ${y + 4}`} />
        <AccessoryTag x={x} y={y} front={front} />
      </g>
    );
  }

  return <AccessoryTag x={x} y={y} front={front} />;
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
