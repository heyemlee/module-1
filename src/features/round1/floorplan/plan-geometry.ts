import type { Cabinet, Round1Normalized } from "@/domain/round1";

export type Wall = "TOP" | "LEFT" | "RIGHT" | "BOTTOM";

export type PlanRect = { x: number; y: number; w: number; h: number };

export type CabinetShape = PlanRect & {
  code: string;
  confirmationRequired: boolean;
};

export type ApplianceSymbol = "sink" | "range" | "fridge" | "dishwasher" | "oven";

export type ApplianceShape = PlanRect & {
  key: string;
  label: string;
  symbol: ApplianceSymbol;
  wall: Wall;
};

export type MarkerLetter = "W" | "G" | "E" | "V";
export type MarkerShape = { cx: number; cy: number; letter: MarkerLetter };

export type WindowShape = PlanRect & { wall: Wall };
export type DoorShape = { breakRect: PlanRect; swingPath: string; labelX: number; labelY: number };

export type DimShape = {
  orientation: "H" | "V";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  lx: number;
  ly: number;
};

export type FloorPlan = {
  canvas: { w: number; h: number };
  room: PlanRect & { thickness: number };
  baseCabinets: CabinetShape[];
  wallCabinets: CabinetShape[];
  corners: PlanRect[];
  appliances: ApplianceShape[];
  island: PlanRect | null;
  window: WindowShape | null;
  door: DoorShape | null;
  markers: MarkerShape[];
  dims: DimShape[];
  confirmationCount: number;
  layoutPreference: string;
  scaleNote: string;
};

const CANVAS = { w: 760, h: 560 };
const MARGIN = { top: 56, right: 88, bottom: 78, left: 80 };
const DEFAULT_LENGTH_IN = 144;
const DEFAULT_WIDTH_IN = 120;

type Fixtures = {
  sink?: { size?: number | null; relation?: string };
  range?: { size?: number | null; relation?: string };
  fridge?: { size?: number | null; relation?: string };
  dishwasher?: { status?: string; size?: number | null; relation?: string };
  hood?: { relation?: string };
};

type LayoutSensitive = {
  ovenMicrowave?: { configuration?: string; relation?: string };
  island?: { requested?: boolean };
};

/**
 * Computes the geometry for a top-down Round 1 kitchen floor plan from the
 * normalized JSON and the preliminary cabinet list. Pure and deterministic:
 * the same inputs always produce the same plan. The renderer (view) only draws
 * what this returns, so all positions/sizes stay testable and reproducible.
 */
export function buildFloorPlan(
  normalized: Round1Normalized,
  cabinets: Cabinet[],
  confirmationCount = 0
): FloorPlan {
  const fixtures = (normalized.fixtures ?? {}) as Fixtures;
  const layoutSensitive = (normalized.layoutSensitiveCabinets ?? {}) as LayoutSensitive;

  const lengthIn = normalized.room.length.value ?? DEFAULT_LENGTH_IN;
  const widthIn = normalized.room.width.value ?? DEFAULT_WIDTH_IN;
  const dimsKnown =
    normalized.room.length.value != null && normalized.room.width.value != null;

  const plotW = CANVAS.w - MARGIN.left - MARGIN.right;
  const plotH = CANVAS.h - MARGIN.top - MARGIN.bottom;
  const scale = Math.min(plotW / lengthIn, plotH / widthIn);

  const roomW = lengthIn * scale;
  const roomH = widthIn * scale;
  const roomX = MARGIN.left + (plotW - roomW) / 2;
  const roomY = MARGIN.top + (plotH - roomH) / 2;
  const thickness = 8;

  const ix = roomX + thickness;
  const iy = roomY + thickness;
  const iw = roomW - thickness * 2;
  const ih = roomH - thickness * 2;

  const baseDepth = clamp(24 * scale, 28, Math.min(iw, ih) * 0.34);
  const wallDepth = baseDepth * 0.52;

  const baseByWall = groupByWall(cabinets.filter((c) => c.kind === "BASE"));
  const wallByWall = groupByWall(cabinets.filter((c) => c.kind === "WALL"));
  const occupiedWalls = new Set<Wall>([
    ...baseByWall.keys(),
    ...wallByWall.keys()
  ]);

  const cornerTL = occupiedWalls.has("TOP") && occupiedWalls.has("LEFT");
  const cornerTR = occupiedWalls.has("TOP") && occupiedWalls.has("RIGHT");
  const cornerBL = occupiedWalls.has("BOTTOM") && occupiedWalls.has("LEFT");
  const cornerBR = occupiedWalls.has("BOTTOM") && occupiedWalls.has("RIGHT");

  const corners: PlanRect[] = [];
  if (cornerTL) corners.push({ x: ix, y: iy, w: baseDepth, h: baseDepth });
  if (cornerTR) corners.push({ x: ix + iw - baseDepth, y: iy, w: baseDepth, h: baseDepth });
  if (cornerBL) corners.push({ x: ix, y: iy + ih - baseDepth, w: baseDepth, h: baseDepth });
  if (cornerBR)
    corners.push({ x: ix + iw - baseDepth, y: iy + ih - baseDepth, w: baseDepth, h: baseDepth });

  const startOffset: Record<Wall, number> = {
    TOP: cornerTL ? baseDepth : 0,
    LEFT: cornerTL ? baseDepth : 0,
    RIGHT: cornerTR ? baseDepth : 0,
    BOTTOM: cornerBL ? baseDepth : 0
  };

  const geom = { ix, iy, iw, ih, scale };
  const baseCabinets: CabinetShape[] = [];
  const wallCabinets: CabinetShape[] = [];
  for (const wall of ["TOP", "LEFT", "RIGHT", "BOTTOM"] as Wall[]) {
    const base = baseByWall.get(wall);
    if (base) baseCabinets.push(...layRun(wall, base, baseDepth, startOffset[wall], geom));
    const wallc = wallByWall.get(wall);
    if (wallc) wallCabinets.push(...layRun(wall, wallc, wallDepth, startOffset[wall], geom));
  }

  const appliances = placeAppliances(fixtures, layoutSensitive, normalized, {
    ix,
    iy,
    iw,
    ih,
    scale,
    baseDepth,
    startOffset,
    cornerTR,
    cornerBR
  });

  const window = placeWindow(normalized, fixtures, appliances, {
    roomX,
    roomY,
    roomW,
    roomH,
    thickness,
    ix,
    iw,
    scale
  });

  const door = placeDoor(normalized, { roomX, roomY, roomW, roomH, thickness, scale });

  const markers = placeMarkers(appliances, baseDepth);

  const island =
    layoutSensitive.island?.requested || /ISLAND/.test(normalized.layoutPreference)
      ? {
          x: ix + iw * 0.32,
          y: iy + ih * 0.36,
          w: iw * 0.36,
          h: ih * 0.3
        }
      : null;

  const dims: DimShape[] = [
    {
      orientation: "H",
      x1: roomX,
      y1: roomY - 18,
      x2: roomX + roomW,
      y2: roomY - 18,
      label: dimsKnown ? `${lengthIn}" rough` : "length unknown",
      lx: roomX + roomW / 2,
      ly: roomY - 23
    },
    {
      orientation: "V",
      x1: roomX - 18,
      y1: roomY,
      x2: roomX - 18,
      y2: roomY + roomH,
      label: dimsKnown ? `${widthIn}" rough` : "width unknown",
      lx: roomX - 23,
      ly: roomY + roomH / 2
    }
  ];

  return {
    canvas: CANVAS,
    room: { x: roomX, y: roomY, w: roomW, h: roomH, thickness },
    baseCabinets,
    wallCabinets,
    corners,
    appliances,
    island,
    window,
    door,
    markers,
    dims,
    confirmationCount,
    layoutPreference: normalized.layoutPreference,
    scaleNote: dimsKnown
      ? `${lengthIn}" x ${widthIn}" rough`
      : "rough dimensions to confirm"
  };
}

function groupByWall(cabinets: Cabinet[]): Map<Wall, Cabinet[]> {
  const map = new Map<Wall, Cabinet[]>();
  for (const cabinet of cabinets) {
    if (cabinet.location === "ON_ISLAND") continue;
    const wall = cabinetWall(cabinet.location);
    const list = map.get(wall) ?? [];
    list.push(cabinet);
    map.set(wall, list);
  }
  return map;
}

function cabinetWall(location: Cabinet["location"]): Wall {
  switch (location) {
    case "LEFT_SIDE":
      return "LEFT";
    case "RIGHT_SIDE":
      return "RIGHT";
    case "FRONT_SIDE":
      return "BOTTOM";
    default:
      return "TOP";
  }
}

type Geom = { ix: number; iy: number; iw: number; ih: number; scale: number };

function layRun(
  wall: Wall,
  cabinets: Cabinet[],
  depth: number,
  startOffset: number,
  { ix, iy, iw, ih, scale }: Geom
): CabinetShape[] {
  const shapes: CabinetShape[] = [];
  const horizontal = wall === "TOP" || wall === "BOTTOM";
  let cursor = (horizontal ? ix : iy) + startOffset;
  const limit = horizontal ? ix + iw : iy + ih;

  for (const cabinet of cabinets) {
    const length = Math.max(cabinet.width * scale, 6);
    if (cursor + length > limit + 0.5) break;
    let rect: PlanRect;
    if (wall === "TOP") rect = { x: cursor, y: iy, w: length, h: depth };
    else if (wall === "BOTTOM") rect = { x: cursor, y: iy + ih - depth, w: length, h: depth };
    else if (wall === "LEFT") rect = { x: ix, y: cursor, w: depth, h: length };
    else rect = { x: ix + iw - depth, y: cursor, w: depth, h: length };

    shapes.push({
      ...rect,
      code: cabinet.code,
      confirmationRequired: cabinet.confirmationRequired
    });
    cursor += length;
  }
  return shapes;
}

type PlaceCtx = {
  ix: number;
  iy: number;
  iw: number;
  ih: number;
  scale: number;
  baseDepth: number;
  startOffset: Record<Wall, number>;
  cornerTR: boolean;
  cornerBR: boolean;
};

function relationToWall(relation: string | undefined, fallback: Wall): Wall {
  switch (relation) {
    case "BACK_SIDE":
    case "ON_MAIN_RUN":
    case "BEHIND_SINK":
      return "TOP";
    case "FRONT_SIDE":
      return "BOTTOM";
    case "LEFT_SIDE":
      return "LEFT";
    case "RIGHT_SIDE":
      return "RIGHT";
    default:
      return fallback;
  }
}

function placeAppliances(
  fixtures: Fixtures,
  layoutSensitive: LayoutSensitive,
  normalized: Round1Normalized,
  ctx: PlaceCtx
): ApplianceShape[] {
  const windowsYes =
    (normalized.openings as { windows?: { status?: string } }).windows?.status === "YES";
  const sinkUnderWindow = windowsYes && fixtures.sink?.relation === "UNDER_WINDOW";

  type Spec = {
    key: string;
    label: string;
    symbol: ApplianceSymbol;
    sizeIn: number;
    wall: Wall;
    deep: boolean;
  };
  const specs: Spec[] = [];

  const sinkWall: Wall = sinkUnderWindow ? "TOP" : relationToWall(fixtures.sink?.relation, "TOP");
  specs.push({
    key: "sink",
    label: "Sink",
    symbol: "sink",
    sizeIn: fixtures.sink?.size ?? 30,
    wall: sinkWall,
    deep: false
  });

  if (fixtures.dishwasher?.status !== "NONE") {
    const dwWall =
      fixtures.dishwasher?.relation === "NEAR_SINK"
        ? sinkWall
        : relationToWall(fixtures.dishwasher?.relation, sinkWall);
    specs.push({
      key: "dishwasher",
      label: "Dishwasher",
      symbol: "dishwasher",
      sizeIn: fixtures.dishwasher?.size ?? 24,
      wall: dwWall,
      deep: false
    });
  }

  specs.push({
    key: "range",
    label: "Range",
    symbol: "range",
    sizeIn: fixtures.range?.size ?? 30,
    wall: relationToWall(fixtures.range?.relation, "TOP"),
    deep: false
  });

  if (layoutSensitive.ovenMicrowave?.configuration === "WALL_OVEN_MICROWAVE_STACK") {
    specs.push({
      key: "oven",
      label: "Oven",
      symbol: "oven",
      sizeIn: 30,
      wall: relationToWall(layoutSensitive.ovenMicrowave?.relation, "TOP"),
      deep: true
    });
  }

  specs.push({
    key: "fridge",
    label: "Fridge",
    symbol: "fridge",
    sizeIn: fixtures.fridge?.size ?? 36,
    wall: relationToWall(fixtures.fridge?.relation, "TOP"),
    deep: true
  });

  const { ix, iy, iw, ih, scale, baseDepth, startOffset, cornerTR, cornerBR } = ctx;
  const shapes: ApplianceShape[] = [];

  for (const wall of ["TOP", "BOTTOM", "LEFT", "RIGHT"] as Wall[]) {
    const onWall = specs.filter((s) => s.wall === wall);
    if (onWall.length === 0) continue;
    const horizontal = wall === "TOP" || wall === "BOTTOM";
    const endCorner =
      wall === "TOP" ? cornerTR : wall === "BOTTOM" ? cornerBR : false;
    const runStart = (horizontal ? ix : iy) + startOffset[wall];
    const runEnd = (horizontal ? ix + iw : iy + ih) - (endCorner ? baseDepth : 0);
    const span = Math.max(runEnd - runStart, 1);

    onWall.forEach((spec, index) => {
      const center = runStart + (span * (index + 1)) / (onWall.length + 1);
      const length = clamp(spec.sizeIn * scale, 18, span * 0.9);
      const depth = spec.deep ? Math.min(36 * scale, baseDepth * 1.35) : baseDepth * 0.9;
      let rect: PlanRect;
      if (wall === "TOP") rect = { x: center - length / 2, y: iy, w: length, h: depth };
      else if (wall === "BOTTOM")
        rect = { x: center - length / 2, y: iy + ih - depth, w: length, h: depth };
      else if (wall === "LEFT") rect = { x: ix, y: center - length / 2, w: depth, h: length };
      else rect = { x: ix + iw - depth, y: center - length / 2, w: depth, h: length };

      shapes.push({
        ...rect,
        key: spec.key,
        label: spec.label,
        symbol: spec.symbol,
        wall
      });
    });
  }

  return shapes;
}

function placeWindow(
  normalized: Round1Normalized,
  fixtures: Fixtures,
  appliances: ApplianceShape[],
  ctx: {
    roomX: number;
    roomY: number;
    roomW: number;
    roomH: number;
    thickness: number;
    ix: number;
    iw: number;
    scale: number;
  }
): WindowShape | null {
  const windows = (normalized.openings as { windows?: { status?: string } }).windows;
  if (windows?.status !== "YES") return null;

  const sink = appliances.find((a) => a.key === "sink");
  const sinkUnderWindow =
    fixtures.sink?.relation === "UNDER_WINDOW" && sink?.wall === "TOP";

  const length = clamp(36 * ctx.scale, 40, ctx.iw * 0.5);
  const centerX =
    sinkUnderWindow && sink ? sink.x + sink.w / 2 : ctx.roomX + ctx.roomW / 2;
  const x = clamp(centerX - length / 2, ctx.ix, ctx.ix + ctx.iw - length);

  return { x, y: ctx.roomY, w: length, h: ctx.thickness, wall: "TOP" };
}

function placeDoor(
  normalized: Round1Normalized,
  ctx: {
    roomX: number;
    roomY: number;
    roomW: number;
    roomH: number;
    thickness: number;
    scale: number;
  }
): DoorShape | null {
  const doors = (normalized.openings as {
    doors?: { status?: string; items?: Array<{ location?: string }> };
  }).doors;
  if (doors?.status === "NO") return null;

  const location = doors?.items?.[0]?.location;
  const wall = relationToWall(location, "BOTTOM");
  const opening = clamp(32 * ctx.scale, 44, 110);
  const { roomX, roomY, roomW, roomH, thickness } = ctx;

  if (wall === "TOP" || wall === "BOTTOM") {
    const cx = clamp(
      roomX + roomW * 0.74,
      roomX + thickness + opening / 2,
      roomX + roomW - thickness - opening / 2
    );
    const wy = wall === "TOP" ? roomY : roomY + roomH - thickness;
    const hingeX = cx + opening / 2;
    const dir = wall === "TOP" ? 1 : -1;
    const tipY = wall === "TOP" ? roomY + thickness : roomY + roomH - thickness;
    const leafEndY = tipY + dir * opening;
    const sweep = wall === "TOP" ? 1 : 1;
    return {
      breakRect: { x: cx - opening / 2, y: wy, w: opening, h: thickness },
      swingPath: `M${hingeX},${leafEndY} A${opening},${opening} 0 0 ${sweep} ${cx - opening / 2},${tipY}`,
      labelX: cx,
      labelY: wall === "TOP" ? roomY - 6 : roomY + roomH + 16
    };
  }

  const cy = clamp(
    roomY + roomH * 0.72,
    roomY + thickness + opening / 2,
    roomY + roomH - thickness - opening / 2
  );
  const wx = wall === "LEFT" ? roomX : roomX + roomW - thickness;
  const tipX = wall === "LEFT" ? roomX + thickness : roomX + roomW - thickness;
  const dir = wall === "LEFT" ? 1 : -1;
  const hingeY = cy + opening / 2;
  const leafEndX = tipX + dir * opening;
  return {
    breakRect: { x: wx, y: cy - opening / 2, w: thickness, h: opening },
    swingPath: `M${leafEndX},${hingeY} A${opening},${opening} 0 0 0 ${tipX},${cy - opening / 2}`,
    labelX: wall === "LEFT" ? roomX - 6 : roomX + roomW + 6,
    labelY: cy
  };
}

function placeMarkers(appliances: ApplianceShape[], baseDepth: number): MarkerShape[] {
  const markers: MarkerShape[] = [];
  const inward = baseDepth * 0.5 + 18;

  const add = (key: string, letter: MarkerLetter, extra = 0) => {
    const a = appliances.find((s) => s.key === key);
    if (!a) return;
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    if (a.wall === "TOP") markers.push({ cx, cy: a.y + a.h + inward + extra, letter });
    else if (a.wall === "BOTTOM") markers.push({ cx, cy: a.y - inward - extra, letter });
    else if (a.wall === "LEFT") markers.push({ cx: a.x + a.w + inward + extra, cy, letter });
    else markers.push({ cx: a.x - inward - extra, cy, letter });
  };

  add("sink", "W");
  add("range", "G");
  add("range", "V", 30);
  add("fridge", "E");
  return markers;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
