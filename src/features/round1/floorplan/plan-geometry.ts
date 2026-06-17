import type { Cabinet, Round1Normalized } from "@/domain/round1";

export type Wall = "TOP" | "LEFT" | "RIGHT" | "BOTTOM";

export type PlanRect = { x: number; y: number; w: number; h: number };

export type CabinetShape = PlanRect & {
  code: string;
  confirmationRequired: boolean;
  wall: Wall;
};

export type ApplianceSymbol = "sink" | "range" | "fridge" | "dishwasher" | "oven" | "hood";

export type ApplianceShape = PlanRect & {
  key: string;
  label: string;
  symbol: ApplianceSymbol;
  wall: Wall;
};

export type MarkerLetter = "W" | "G" | "E" | "V";
export type MarkerShape = { cx: number; cy: number; letter: MarkerLetter };

export type WindowShape = PlanRect & { wall: Wall };
export type DoorShape = { breakRect: PlanRect; swingPath: string; leafRect: PlanRect; labelX: number; labelY: number; wall: Wall; cx: number; cy: number };
export type ClearanceZoneShape = PlanRect & {
  ownerKey: string;
  wall: Wall;
  kind: "FRONT_ACCESS" | "DOOR_SWING";
};

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

export type WallCornerShape = PlanRect & { type: "TL" | "TR" | "BL" | "BR"; wallDepth: number };

export type FloorPlan = {
  canvas: { w: number; h: number };
  room: PlanRect & { thickness: number };
  baseCabinets: CabinetShape[];
  wallCabinets: CabinetShape[];
  corners: PlanRect[];
  wallCorners: WallCornerShape[];
  appliances: ApplianceShape[];
  clearanceZones: ClearanceZoneShape[];
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
const DEFAULT_LENGTH_IN = 210;
const DEFAULT_WIDTH_IN = 150;

type Fixtures = {
  sink?: { size?: number | null; relation?: string };
  range?: { size?: number | null; relation?: string };
  fridge?: { size?: number | null; relation?: string };
  dishwasher?: { status?: string; size?: number | null; relation?: string };
  hood?: { relation?: string };
};

type LayoutSensitive = {
  ovenMicrowave?: { configuration?: string; relation?: string };
  cookingAppliances?: {
    range?: { status?: string; relation?: string };
    cooktop?: { status?: string; relation?: string };
    wallOven?: { status?: string; relation?: string };
    microwaveOvenCombo?: { status?: string; relation?: string };
  };
  island?: { requested?: boolean };
};

/**
 * Computes the geometry for a top-down Round 1 kitchen floor plan from the
 * normalized JSON and the preliminary cabinet list. Pure and deterministic:
 * the same inputs always produce the same plan. The renderer (view) only draws
 * what this returns, so all positions/sizes stay testable and reproducible.
 */
export type PositionOverride = {
  wall: Wall;
  position: number;
};

export type PositionOverrides = Record<string, PositionOverride>;

export function buildFloorPlan(
  normalized: Round1Normalized,
  cabinets: Cabinet[],
  confirmationCount = 0,
  overrides: PositionOverrides = {}
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
    ...allowedDragWallsForLayout(normalized.layoutPreference),
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

  const wallCornerTL = wallByWall.has("TOP") && wallByWall.has("LEFT");
  const wallCornerTR = wallByWall.has("TOP") && wallByWall.has("RIGHT");
  const wallCornerBL = wallByWall.has("BOTTOM") && wallByWall.has("LEFT");
  const wallCornerBR = wallByWall.has("BOTTOM") && wallByWall.has("RIGHT");

  const wallCorners: WallCornerShape[] = [];
  if (wallCornerTL) wallCorners.push({ x: ix, y: iy, w: baseDepth, h: baseDepth, type: "TL", wallDepth });
  if (wallCornerTR) wallCorners.push({ x: ix + iw - baseDepth, y: iy, w: baseDepth, h: baseDepth, type: "TR", wallDepth });
  if (wallCornerBL) wallCorners.push({ x: ix, y: iy + ih - baseDepth, w: baseDepth, h: baseDepth, type: "BL", wallDepth });
  if (wallCornerBR) wallCorners.push({ x: ix + iw - baseDepth, y: iy + ih - baseDepth, w: baseDepth, h: baseDepth, type: "BR", wallDepth });

  const startOffset: Record<Wall, number> = {
    TOP: cornerTL ? baseDepth : 0,
    LEFT: cornerTL ? baseDepth : 0,
    RIGHT: cornerTR ? baseDepth : 0,
    BOTTOM: cornerBL ? baseDepth : 0
  };

  const endOffset: Record<Wall, number> = {
    TOP: cornerTR ? baseDepth : 0,
    LEFT: cornerBL ? baseDepth : 0,
    RIGHT: cornerBR ? baseDepth : 0,
    BOTTOM: cornerBR ? baseDepth : 0
  };

  const appliances = placeAppliances(fixtures, layoutSensitive, normalized, {
    ix,
    iy,
    iw,
    ih,
    scale,
    baseDepth,
    startOffset,
    endOffset,
    overrides
  });

  const door = placeDoor(normalized, {
    roomX,
    roomY,
    roomW,
    roomH,
    thickness,
    scale,
    overrides,
    fixedObjects: appliances
  });

  const clearanceZones = buildClearanceZones(appliances, door, {
    ix,
    iy,
    iw,
    ih,
    scale,
    baseDepth
  });

  const sharedCabinetObstacles: PlanRect[] = appliances.filter(
    (a) => a.key === "range" || a.symbol === "fridge" || a.symbol === "oven"
  );
  sharedCabinetObstacles.push(...clearanceZones);
  if (door) {
    let dw = door.breakRect.w;
    let dh = door.breakRect.h;
    let dx = door.breakRect.x;
    let dy = door.breakRect.y;
    if (dw > dh) {
      dy -= baseDepth; 
      dh += baseDepth * 2;
    } else {
      dx -= baseDepth;
      dw += baseDepth * 2;
    }
    sharedCabinetObstacles.push({ x: dx, y: dy, w: dw, h: dh });
  }
  const baseObstacles: PlanRect[] = [
    ...sharedCabinetObstacles,
    ...appliances.filter((a) => a.symbol === "sink" || a.symbol === "dishwasher")
  ];
  
  const geom = { ix, iy, iw, ih, scale };
  const baseCabinets: CabinetShape[] = [];
  
  // 1. Layout base cabinets
  for (const wall of ["TOP", "LEFT", "RIGHT", "BOTTOM"] as Wall[]) {
    const base = baseByWall.get(wall);
    if (base) {
      baseCabinets.push(...layRun(wall, base, baseDepth, startOffset[wall], endOffset[wall], geom, baseObstacles, true));
      baseCabinets.push(
        ...fillGenericCabinetGaps(
          wall,
          baseCabinets,
          baseDepth,
          startOffset[wall],
          endOffset[wall],
          geom,
          baseObstacles,
          "ROUND1_GENERIC_BASE"
        )
      );
    }
  }

  // 2. Place window from fixed appliance positions. Cabinet fill must not move
  // or resize fixed appliances; Round 1 cabinets adapt around them instead.
  const window = placeWindow(normalized, fixtures, appliances, {
    roomX,
    roomY,
    roomW,
    roomH,
    thickness,
    ix,
    iy,
    iw,
    ih,
    scale,
    overrides
  });

  const wallObstacles: PlanRect[] = [...sharedCabinetObstacles];
  if (window) wallObstacles.push(window);

  // 4. Layout wall cabinets
  const wallCabinets: CabinetShape[] = [];
  for (const wall of ["TOP", "LEFT", "RIGHT", "BOTTOM"] as Wall[]) {
    const wallc = wallByWall.get(wall);
    if (wallc) {
      wallCabinets.push(...layRun(wall, wallc, wallDepth, startOffset[wall], endOffset[wall], geom, wallObstacles, false));
      wallCabinets.push(
        ...fillGenericCabinetGaps(
          wall,
          wallCabinets,
          wallDepth,
          startOffset[wall],
          endOffset[wall],
          geom,
          wallObstacles,
          "ROUND1_GENERIC_WALL"
        )
      );
    }
  }

  // 5. Post-process to ensure every wall cabinet has a base cabinet beneath it
  for (const wc of wallCabinets) {
    const horizontal = wc.wall === "TOP" || wc.wall === "BOTTOM";
    
    // Check if there is already a base cabinet or base obstacle intersecting this area
    const hasBase = baseCabinets.some(bc => rectIntersect(bc, wc)) || 
                    baseObstacles.some(o => rectIntersect(o, wc));

    // If not, we generate a visual filler base cabinet
    if (!hasBase) {
      let bx = wc.x, by = wc.y, bw = wc.w, bh = wc.h;
      if (wc.wall === "TOP") { bh = baseDepth; }
      else if (wc.wall === "BOTTOM") { by = iy + ih - baseDepth; bh = baseDepth; }
      else if (wc.wall === "LEFT") { bw = baseDepth; }
      else if (wc.wall === "RIGHT") { bx = ix + iw - baseDepth; bw = baseDepth; }

      baseCabinets.push({
        x: bx, y: by, w: bw, h: bh, wall: wc.wall, code: "Visual Base", confirmationRequired: false
      });
    }
  }

  const markers = placeMarkers(appliances, baseDepth);

  const rangeAppliance = appliances.find(a => a.symbol === "range");
  if (rangeAppliance) {
    const wallDepth = baseDepth * 0.52;
    let hoodRect: PlanRect;
    if (rangeAppliance.wall === "TOP") hoodRect = { x: rangeAppliance.x, y: roomY + thickness, w: rangeAppliance.w, h: wallDepth };
    else if (rangeAppliance.wall === "BOTTOM") hoodRect = { x: rangeAppliance.x, y: roomY + roomH - thickness - wallDepth, w: rangeAppliance.w, h: wallDepth };
    else if (rangeAppliance.wall === "LEFT") hoodRect = { x: roomX + thickness, y: rangeAppliance.y, w: wallDepth, h: rangeAppliance.h };
    else hoodRect = { x: roomX + roomW - thickness - wallDepth, y: rangeAppliance.y, w: wallDepth, h: rangeAppliance.h };
    
    appliances.push({
      ...hoodRect,
      key: "hood",
      label: "",
      symbol: "hood",
      wall: rangeAppliance.wall
    });
  }

  const island = placeIsland(normalized, layoutSensitive, {
    ix,
    iy,
    iw,
    ih,
    clearanceZones
  });

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
    wallCorners,
    appliances,
    clearanceZones,
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
  endOffset: number,
  { ix, iy, iw, ih, scale }: Geom,
  obstacles: PlanRect[] = [],
  snapObstacles: boolean = true
): CabinetShape[] {
  const shapes: CabinetShape[] = [];
  const horizontal = wall === "TOP" || wall === "BOTTOM";
  let cursor = (horizontal ? ix : iy) + startOffset;
  const limit = (horizontal ? ix + iw : iy + ih) - endOffset;

  let trackRect: PlanRect;
  if (wall === "TOP") trackRect = { x: ix, y: iy, w: iw, h: depth };
  else if (wall === "BOTTOM") trackRect = { x: ix, y: iy + ih - depth, w: iw, h: depth };
  else if (wall === "LEFT") trackRect = { x: ix, y: iy, w: depth, h: ih };
  else trackRect = { x: ix + iw - depth, y: iy, w: depth, h: ih };

  const wallObstacles = obstacles
    .filter(o => rectIntersect(o, trackRect))
    .map(o => ({
      start: horizontal ? o.x : o.y,
      end: horizontal ? o.x + o.w : o.y + o.h,
      ref: o
    }))
    .sort((a, b) => a.start - b.start);

  for (const cabinet of cabinets) {
    let length = Math.max(cabinet.width * scale, 6);
    
    let placed = false;
    let dropped = false;
    while (!placed) {
      if (cursor + length > limit + 0.5) {
        if (limit - cursor >= 6) {
          length = limit - cursor;
        } else {
          dropped = true;
          break;
        }
      }
      
      const overlap = wallObstacles.find(o => 
        cursor < o.end - 0.1 && cursor + length > o.start + 0.1
      );

      if (overlap) {
        const gap = overlap.start - cursor;
        if (gap >= 6) {
          length = gap;
          placed = true;
        } else {
          cursor = Math.max(cursor, overlap.end);
        }
      } else {
        placed = true;
      }
    }

    if (dropped) continue;

    let rect: PlanRect;
    if (wall === "TOP") rect = { x: cursor, y: iy, w: length, h: depth };
    else if (wall === "BOTTOM") rect = { x: cursor, y: iy + ih - depth, w: length, h: depth };
    else if (wall === "LEFT") rect = { x: ix, y: cursor, w: depth, h: length };
    else rect = { x: ix + iw - depth, y: cursor, w: depth, h: length };

    shapes.push({
      ...rect,
      wall,
      code: cabinet.code,
      confirmationRequired: cabinet.confirmationRequired
    });
    cursor += length;
  }
  return shapes;
}

function fillGenericCabinetGaps(
  wall: Wall,
  existing: CabinetShape[],
  depth: number,
  startOffset: number,
  endOffset: number,
  { ix, iy, iw, ih }: Geom,
  obstacles: PlanRect[] = [],
  codePrefix: string
): CabinetShape[] {
  const horizontal = wall === "TOP" || wall === "BOTTOM";
  const start = (horizontal ? ix : iy) + startOffset;
  const limit = (horizontal ? ix + iw : iy + ih) - endOffset;
  const minGap = 8;

  let trackRect: PlanRect;
  if (wall === "TOP") trackRect = { x: ix, y: iy, w: iw, h: depth };
  else if (wall === "BOTTOM") trackRect = { x: ix, y: iy + ih - depth, w: iw, h: depth };
  else if (wall === "LEFT") trackRect = { x: ix, y: iy, w: depth, h: ih };
  else trackRect = { x: ix + iw - depth, y: iy, w: depth, h: ih };

  const occupied = [
    ...existing
      .filter((cabinet) => cabinet.wall === wall)
      .map((cabinet) => ({
        start: horizontal ? cabinet.x : cabinet.y,
        end: horizontal ? cabinet.x + cabinet.w : cabinet.y + cabinet.h
      })),
    ...obstacles
      .filter((obstacle) => rectIntersect(obstacle, trackRect))
      .map((obstacle) => ({
        start: horizontal ? obstacle.x : obstacle.y,
        end: horizontal ? obstacle.x + obstacle.w : obstacle.y + obstacle.h
      }))
  ]
    .map((interval) => ({
      start: clamp(interval.start, start, limit),
      end: clamp(interval.end, start, limit)
    }))
    .filter((interval) => interval.end - interval.start > 0.5)
    .sort((a, b) => a.start - b.start);

  const shapes: CabinetShape[] = [];
  let cursor = start;
  occupied.forEach((interval, index) => {
    if (interval.start - cursor >= minGap) {
      shapes.push(
        makeGenericCabinet(wall, cursor, interval.start - cursor, depth, {
          ix,
          iy,
          iw,
          ih
        }, `${codePrefix}_${wall}_${index}`)
      );
    }
    cursor = Math.max(cursor, interval.end);
  });

  if (limit - cursor >= minGap) {
    shapes.push(
      makeGenericCabinet(wall, cursor, limit - cursor, depth, { ix, iy, iw, ih }, `${codePrefix}_${wall}_END`)
    );
  }

  return shapes;
}

function makeGenericCabinet(
  wall: Wall,
  axisStart: number,
  axisLength: number,
  depth: number,
  { ix, iy, ih, iw }: { ix: number; iy: number; iw: number; ih: number },
  code: string
): CabinetShape {
  let rect: PlanRect;
  if (wall === "TOP") rect = { x: axisStart, y: iy, w: axisLength, h: depth };
  else if (wall === "BOTTOM") rect = { x: axisStart, y: iy + ih - depth, w: axisLength, h: depth };
  else if (wall === "LEFT") rect = { x: ix, y: axisStart, w: depth, h: axisLength };
  else rect = { x: ix + iw - depth, y: axisStart, w: depth, h: axisLength };

  return {
    ...rect,
    wall,
    code,
    confirmationRequired: false
  };
}

type PlaceCtx = {
  ix: number;
  iy: number;
  iw: number;
  ih: number;
  scale: number;
  baseDepth: number;
  startOffset: Record<Wall, number>;
  endOffset: Record<Wall, number>;
  overrides: PositionOverrides;
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

export function allowedDragWallsForLayout(layoutPreference: string): Wall[] {
  switch (layoutPreference) {
    case "GALLEY":
      return ["TOP", "BOTTOM"];
    case "L_SHAPE":
    case "PENINSULA":
    case "L_SHAPE_ISLAND":
      return ["TOP", "LEFT"];
    case "U_SHAPE":
    case "U_SHAPE_ISLAND":
      return ["TOP", "LEFT", "RIGHT"];
    case "ISLAND":
    case "ONE_WALL":
    case "NO_PREFERENCE":
    default:
      return ["TOP"];
  }
}

function wallAllowed(wall: Wall, layoutPreference: string): boolean {
  return allowedDragWallsForLayout(layoutPreference).includes(wall);
}

function overrideWall(
  overrides: PositionOverrides,
  key: string,
  fallback: Wall,
  layoutPreference?: string
): Wall {
  const override = overrides[key];
  if (!override) return fallback;
  if (layoutPreference && !wallAllowed(override.wall, layoutPreference)) return fallback;
  return override.wall;
}

function overridePosition(
  overrides: PositionOverrides,
  key: string
): number | undefined {
  return overrides[key]?.position;
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
  const cooking = layoutSensitive.cookingAppliances;

  const sinkFallbackWall: Wall = sinkUnderWindow ? "TOP" : relationToWall(fixtures.sink?.relation, "TOP");
  const sinkWall = overrideWall(ctx.overrides, "sink", sinkFallbackWall, normalized.layoutPreference);
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
    const dishwasherWall = overrideWall(
      ctx.overrides,
      "dishwasher",
      dwWall,
      normalized.layoutPreference
    );
    specs.push({
      key: "dishwasher",
      label: "Dishwasher",
      symbol: "dishwasher",
      sizeIn: fixtures.dishwasher?.size ?? 24,
      wall: dishwasherWall,
      deep: false
    });
  }

  if (cooking?.range?.status !== "NO") {
    const rangeWall = overrideWall(
      ctx.overrides,
      "range",
      relationToWall(cooking?.range?.relation ?? fixtures.range?.relation, "TOP"),
      normalized.layoutPreference
    );

    specs.push({
      key: "range",
      label: "Range",
      symbol: "range",
      sizeIn: fixtures.range?.size ?? 30,
      wall: rangeWall,
      deep: true
    });
  }

  if (cooking?.cooktop?.status === "YES") {
    specs.push({
      key: "cooktop",
      label: "Cooktop",
      symbol: "range",
      sizeIn: 30,
      wall: overrideWall(
        ctx.overrides,
        "cooktop",
        relationToWall(cooking.cooktop.relation, "TOP"),
        normalized.layoutPreference
      ),
      deep: false
    });
  }

  if (cooking?.wallOven?.status === "YES") {
    specs.push({
      key: "wallOven",
      label: "Wall oven",
      symbol: "oven",
      sizeIn: 30,
      wall: overrideWall(
        ctx.overrides,
        "wallOven",
        relationToWall(cooking.wallOven.relation, "TOP"),
        normalized.layoutPreference
      ),
      deep: true
    });
  }

  if (cooking?.microwaveOvenCombo?.status === "YES") {
    specs.push({
      key: "microwaveOvenCombo",
      label: "Microwave / oven combo",
      symbol: "oven",
      sizeIn: 30,
      wall: overrideWall(
        ctx.overrides,
        "microwaveOvenCombo",
        relationToWall(cooking.microwaveOvenCombo.relation, "TOP"),
        normalized.layoutPreference
      ),
      deep: true
    });
  }

  const fridgeWall = overrideWall(
    ctx.overrides,
    "fridge",
    relationToWall(fixtures.fridge?.relation, "TOP"),
    normalized.layoutPreference
  );

  specs.push({
    key: "fridge",
    label: "Fridge",
    symbol: "fridge",
    sizeIn: fixtures.fridge?.size ?? 36,
    wall: fridgeWall,
    deep: true
  });

  const { ix, iy, iw, ih, scale, baseDepth, startOffset, endOffset } = ctx;
  const shapes: ApplianceShape[] = [];

  for (const wall of ["TOP", "BOTTOM", "LEFT", "RIGHT"] as Wall[]) {
    const onWall = specs.filter((s) => s.wall === wall);
    if (onWall.length === 0) continue;
    const horizontal = wall === "TOP" || wall === "BOTTOM";
    const runStart = (horizontal ? ix : iy) + startOffset[wall];
    const runEnd = (horizontal ? ix + iw : iy + ih) - endOffset[wall];
    const span = Math.max(runEnd - runStart, 1);

    const rawLengths = onWall.map(spec => clamp(spec.sizeIn * scale, 18, span * 0.9));
    const totalApplianceWidth = rawLengths.reduce((sum, l) => sum + l, 0);
    
    // If appliances total width exceeds the wall, squish them so they don't break out of the room layout
    const fitFactor = totalApplianceWidth > span ? (span * 0.95) / totalApplianceWidth : 1;
    const rawSpacing = Math.max((span - totalApplianceWidth) / (onWall.length + 1), 0);
    // Cap spacing so appliances stay clustered, allowing base cabinets to connect them
    const spacing = Math.min(rawSpacing, 12 * scale);
    let cursor = runStart + (totalApplianceWidth > span ? (span * 0.025) : spacing);
    const occupied: AxisInterval[] = [];

    onWall.forEach((spec, idx) => {
      const length = rawLengths[idx] * fitFactor;
      const depth = (spec.symbol === "sink" || spec.symbol === "dishwasher") 
        ? baseDepth 
        : (spec.symbol === "range" ? baseDepth * 1.05 
          : (spec.deep ? Math.min(32 * scale, baseDepth * 1.15) : baseDepth * 0.9));
      
      let trackRect: PlanRect;
      if (wall === "TOP") trackRect = { x: ix, y: iy, w: iw, h: depth };
      else if (wall === "BOTTOM") trackRect = { x: ix, y: iy + ih - depth, w: iw, h: depth };
      else if (wall === "LEFT") trackRect = { x: ix, y: iy, w: depth, h: ih };
      else trackRect = { x: ix + iw - depth, y: iy, w: depth, h: ih };

      const currentOccupied = [...occupied];
      for (const shape of shapes) {
        if (shape.wall === wall) continue;
        let crossIntersect = false;
        if (horizontal) {
          crossIntersect = shape.y < trackRect.y + trackRect.h && shape.y + shape.h > trackRect.y;
        } else {
          crossIntersect = shape.x < trackRect.x + trackRect.w && shape.x + shape.w > trackRect.x;
        }
        if (crossIntersect) {
          if (horizontal) {
            currentOccupied.push({ start: shape.x, end: shape.x + shape.w });
          } else {
            currentOccupied.push({ start: shape.y, end: shape.y + shape.h });
          }
        }
      }

      const preferred = overridePosition(ctx.overrides, spec.key) ?? cursor;
      const limitMin = horizontal ? ix + ctx.startOffset[wall] : iy + ctx.startOffset[wall];
      const limitMax = horizontal ? ix + iw - ctx.endOffset[wall] - length : iy + ih - ctx.endOffset[wall] - length;
      const pos = nearestNonOverlappingStart(preferred, length, limitMin, limitMax, currentOccupied);

      let rect: PlanRect;
      if (wall === "TOP") rect = { x: pos, y: iy, w: length, h: depth };
      else if (wall === "BOTTOM")
        rect = { x: pos, y: iy + ih - depth, w: length, h: depth };
      else if (wall === "LEFT") rect = { x: ix, y: pos, w: depth, h: length };
      else rect = { x: ix + iw - depth, y: pos, w: depth, h: length };

      shapes.push({
        ...rect,
        key: spec.key,
        label: spec.label,
        symbol: spec.symbol as ApplianceSymbol,
        wall
      });

      occupied.push({ start: pos, end: pos + length });
      occupied.sort((a, b) => a.start - b.start);
      cursor += length + spacing;
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
    iy: number;
    iw: number;
    ih: number;
    scale: number;
    overrides: PositionOverrides;
  }
): WindowShape | null {
  const windows = (normalized.openings as { windows?: { status?: string; items?: Array<{ relation?: string }> } }).windows;
  if (windows?.status !== "YES") return null;

  const relation = windows?.items?.[0]?.relation;
  const sink = appliances.find((a) => a.key === "sink");
  const sinkUnderWindow = fixtures.sink?.relation === "UNDER_WINDOW" || relation === "BEHIND_SINK";

  let wall = overrideWall(ctx.overrides, "window", relationToWall(relation, "TOP"));
  if (sinkUnderWindow && sink) {
    wall = overrideWall(ctx.overrides, "window", sink.wall);
  }

  const length = clamp(36 * ctx.scale, 40, (wall === "TOP" || wall === "BOTTOM" ? ctx.iw : ctx.ih) * 0.5);

  let x = 0;
  let y = 0;
  let w = 0;
  let h = 0;

  if (wall === "TOP" || wall === "BOTTOM") {
    w = length;
    h = ctx.thickness;
    const centerX = (sinkUnderWindow && sink && sink.wall === wall) ? sink.x + sink.w / 2 : ctx.roomX + ctx.roomW / 2;
    const defaultX = clamp(centerX - length / 2, ctx.ix, ctx.ix + ctx.iw - length);
    x = overridePosition(ctx.overrides, "window") !== undefined ? clamp(overridePosition(ctx.overrides, "window")!, ctx.ix, ctx.ix + ctx.iw - length) : defaultX;
    y = wall === "TOP" ? ctx.roomY : ctx.roomY + ctx.roomH - ctx.thickness;
  } else {
    w = ctx.thickness;
    h = length;
    const centerY = (sinkUnderWindow && sink && sink.wall === wall) ? sink.y + sink.h / 2 : ctx.roomY + ctx.roomH / 2;
    const defaultY = clamp(centerY - length / 2, ctx.iy, ctx.iy + ctx.ih - length);
    y = overridePosition(ctx.overrides, "window") !== undefined ? clamp(overridePosition(ctx.overrides, "window")!, ctx.iy, ctx.iy + ctx.ih - length) : defaultY;
    x = wall === "LEFT" ? ctx.roomX : ctx.roomX + ctx.roomW - ctx.thickness;
  }

  const windowShape: WindowShape = { x, y, w, h, wall };
  if (sink && sink.wall === wall && wallProjectionOverlapRatio(windowShape, sink) >= 0.75) {
    alignShapeCenterOnAxis(sink, windowShape, {
      ix: ctx.ix,
      iy: ctx.iy,
      iw: ctx.iw,
      ih: ctx.ih
    });
  }

  return windowShape;
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
    overrides: PositionOverrides;
    fixedObjects?: Array<PlanRect & { wall: Wall }>;
  }
): DoorShape | null {
  const doors = (normalized.openings as {
    doors?: { status?: string; items?: Array<{ location?: string }> };
  }).doors;
  if (doors?.status === "NO") return null;

  const location = doors?.items?.[0]?.location;
  const wall = overrideWall(ctx.overrides, "door", relationToWall(location, "BOTTOM"));
  const opening = clamp(32 * ctx.scale, 44, 110);
  const { roomX, roomY, roomW, roomH, thickness } = ctx;

  if (wall === "TOP" || wall === "BOTTOM") {
    const minStart = roomX + thickness;
    const maxStart = roomX + roomW - thickness - opening;
    const occupied = intervalsForWall(ctx.fixedObjects ?? [], wall, true);
    const defaultCx = clamp(
      roomX + roomW * 0.74,
      roomX + thickness + opening / 2,
      roomX + roomW - thickness - opening / 2
    );
    const preferredStart = (overridePosition(ctx.overrides, "door") ?? defaultCx) - opening / 2;
    const start = nearestNonOverlappingStart(preferredStart, opening, minStart, maxStart, occupied);
    const cx = start + opening / 2;
    const wy = wall === "TOP" ? roomY : roomY + roomH - thickness;
    const hingeX = cx + opening / 2;
    const dir = wall === "TOP" ? 1 : -1;
    const tipY = wall === "TOP" ? roomY + thickness : roomY + roomH - thickness;
    const leafEndY = tipY + dir * opening;
    const sweep = wall === "TOP" ? 1 : 0;
    
    let leafRect: PlanRect;
    if (wall === "TOP") {
      leafRect = { x: hingeX - 3.5, y: tipY, w: 3.5, h: opening };
    } else {
      leafRect = { x: hingeX - 3.5, y: tipY - opening, w: 3.5, h: opening };
    }

    return {
      breakRect: { x: cx - opening / 2, y: wy, w: opening, h: thickness },
      swingPath: `M${hingeX},${leafEndY} A${opening},${opening} 0 0 ${sweep} ${cx - opening / 2},${tipY}`,
      leafRect,
      labelX: cx,
      labelY: wall === "TOP" ? roomY - 6 : roomY + roomH + 16,
      wall,
      cx,
      cy: wy
    };
  }

  const defaultCy = clamp(
    roomY + roomH * 0.72,
    roomY + thickness + opening / 2,
    roomY + roomH - thickness - opening / 2
  );
  const minStart = roomY + thickness;
  const maxStart = roomY + roomH - thickness - opening;
  const occupied = intervalsForWall(ctx.fixedObjects ?? [], wall, false);
  const preferredStart = (overridePosition(ctx.overrides, "door") ?? defaultCy) - opening / 2;
  const start = nearestNonOverlappingStart(preferredStart, opening, minStart, maxStart, occupied);
  const cy = start + opening / 2;
  const wx = wall === "LEFT" ? roomX : roomX + roomW - thickness;
  const tipX = wall === "LEFT" ? roomX + thickness : roomX + roomW - thickness;
  const dir = wall === "LEFT" ? 1 : -1;
  const hingeY = cy + opening / 2;
  const leafEndX = tipX + dir * opening;
  const sweep = wall === "LEFT" ? 0 : 1;
  
  let leafRect: PlanRect;
  if (wall === "LEFT") {
    leafRect = { x: tipX, y: hingeY - 3.5, w: opening, h: 3.5 };
  } else {
    leafRect = { x: tipX - opening, y: hingeY - 3.5, w: opening, h: 3.5 };
  }

  return {
    breakRect: { x: wx, y: cy - opening / 2, w: thickness, h: opening },
    swingPath: `M${leafEndX},${hingeY} A${opening},${opening} 0 0 ${sweep} ${tipX},${cy - opening / 2}`,
    leafRect,
    labelX: wall === "LEFT" ? roomX - 16 : roomX + roomW + 16,
    labelY: cy,
    wall,
    cx: wx,
    cy
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

type AxisInterval = { start: number; end: number };

function intervalsForWall(
  objects: Array<PlanRect & { wall: Wall }>,
  wall: Wall,
  horizontal: boolean
): AxisInterval[] {
  return objects
    .filter((object) => object.wall === wall)
    .map((object) => ({
      start: horizontal ? object.x : object.y,
      end: horizontal ? object.x + object.w : object.y + object.h
    }))
    .sort((a, b) => a.start - b.start);
}

function nearestNonOverlappingStart(
  preferred: number,
  length: number,
  minStart: number,
  maxStart: number,
  occupied: AxisInterval[]
): number {
  const clampedPreferred = clamp(preferred, minStart, maxStart);
  const sorted = occupied
    .map((item) => ({
      start: Math.max(item.start, minStart),
      end: Math.min(item.end, maxStart + length)
    }))
    .filter((item) => item.end > minStart && item.start < maxStart + length)
    .sort((a, b) => a.start - b.start);

  const valid: Array<{ start: number; end: number }> = [];
  let cursor = minStart;
  for (const item of sorted) {
    const gapEnd = item.start;
    if (gapEnd - cursor >= length) {
      valid.push({ start: cursor, end: gapEnd - length });
    }
    cursor = Math.max(cursor, item.end);
  }
  if (maxStart + length - cursor >= length) {
    valid.push({ start: cursor, end: maxStart });
  }

  if (valid.length === 0) {
    return clampedPreferred;
  }

  return valid
    .map((range) => clamp(clampedPreferred, range.start, range.end))
    .sort((a, b) => Math.abs(a - clampedPreferred) - Math.abs(b - clampedPreferred))[0];
}

function buildClearanceZones(
  appliances: ApplianceShape[],
  door: DoorShape | null,
  ctx: {
    ix: number;
    iy: number;
    iw: number;
    ih: number;
    scale: number;
    baseDepth: number;
  }
): ClearanceZoneShape[] {
  const zones: ClearanceZoneShape[] = [];
  for (const appliance of appliances) {
    if (appliance.symbol === "hood") continue;
    const depthIn =
      appliance.symbol === "fridge" ||
      appliance.symbol === "range" ||
      appliance.symbol === "oven" ||
      appliance.symbol === "dishwasher"
        ? 36
        : 30;
    const depth = clamp(depthIn * ctx.scale, ctx.baseDepth * 0.85, Math.max(ctx.iw, ctx.ih));
    const zone = frontZone(appliance, depth, {
      ix: ctx.ix,
      iy: ctx.iy,
      iw: ctx.iw,
      ih: ctx.ih
    });
    if (zone.w > 1 && zone.h > 1) {
      zones.push({
        ...zone,
        ownerKey: appliance.key,
        wall: appliance.wall,
        kind: "FRONT_ACCESS"
      });
    }
  }

  if (door) {
    const swing = clampRectToInterior(door.leafRect, {
      ix: ctx.ix,
      iy: ctx.iy,
      iw: ctx.iw,
      ih: ctx.ih
    });
    if (swing.w > 1 && swing.h > 1) {
      zones.push({
        ...swing,
        ownerKey: "door",
        wall: door.wall,
        kind: "DOOR_SWING"
      });
    }
  }

  return zones;
}

function frontZone(
  rect: PlanRect & { wall: Wall },
  depth: number,
  bounds: { ix: number; iy: number; iw: number; ih: number }
): PlanRect {
  if (rect.wall === "TOP") {
    return clampRectToInterior(
      { x: rect.x, y: rect.y + rect.h, w: rect.w, h: depth },
      bounds
    );
  }
  if (rect.wall === "BOTTOM") {
    return clampRectToInterior(
      { x: rect.x, y: rect.y - depth, w: rect.w, h: depth },
      bounds
    );
  }
  if (rect.wall === "LEFT") {
    return clampRectToInterior(
      { x: rect.x + rect.w, y: rect.y, w: depth, h: rect.h },
      bounds
    );
  }
  return clampRectToInterior(
    { x: rect.x - depth, y: rect.y, w: depth, h: rect.h },
    bounds
  );
}

function clampRectToInterior(
  rect: PlanRect,
  bounds: { ix: number; iy: number; iw: number; ih: number }
): PlanRect {
  const x1 = clamp(rect.x, bounds.ix, bounds.ix + bounds.iw);
  const y1 = clamp(rect.y, bounds.iy, bounds.iy + bounds.ih);
  const x2 = clamp(rect.x + rect.w, bounds.ix, bounds.ix + bounds.iw);
  const y2 = clamp(rect.y + rect.h, bounds.iy, bounds.iy + bounds.ih);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1)
  };
}

function placeIsland(
  normalized: Round1Normalized,
  layoutSensitive: LayoutSensitive,
  ctx: {
    ix: number;
    iy: number;
    iw: number;
    ih: number;
    clearanceZones: ClearanceZoneShape[];
  }
): PlanRect | null {
  if (!layoutSensitive.island?.requested && !/ISLAND/.test(normalized.layoutPreference)) {
    return null;
  }

  const sizeOptions = [
    { w: ctx.iw * 0.36, h: ctx.ih * 0.3 },
    { w: ctx.iw * 0.3, h: ctx.ih * 0.24 },
    { w: ctx.iw * 0.24, h: ctx.ih * 0.18 }
  ];
  const centerXOptions = [0.5, 0.42, 0.58, 0.34, 0.66];
  const centerYOptions = [0.5, 0.42, 0.58, 0.34, 0.66];

  for (const size of sizeOptions) {
    for (const centerY of centerYOptions) {
      for (const centerX of centerXOptions) {
        const candidate = {
          x: clamp(
            ctx.ix + ctx.iw * centerX - size.w / 2,
            ctx.ix,
            ctx.ix + ctx.iw - size.w
          ),
          y: clamp(
            ctx.iy + ctx.ih * centerY - size.h / 2,
            ctx.iy,
            ctx.iy + ctx.ih - size.h
          ),
          w: size.w,
          h: size.h
        };
        if (ctx.clearanceZones.every((zone) => !rectIntersect(candidate, zone))) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function rectIntersect(r1: PlanRect, r2: PlanRect): boolean {
  return (
    r1.x < r2.x + r2.w - 0.1 &&
    r1.x + r1.w > r2.x + 0.1 &&
    r1.y < r2.y + r2.h - 0.1 &&
    r1.y + r1.h > r2.y + 0.1
  );
}

function rectOverlapRatio(r1: PlanRect, r2: PlanRect): number {
  const xOverlap = Math.max(
    0,
    Math.min(r1.x + r1.w, r2.x + r2.w) - Math.max(r1.x, r2.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(r1.y + r1.h, r2.y + r2.h) - Math.max(r1.y, r2.y)
  );
  const overlapArea = xOverlap * yOverlap;
  const smallerArea = Math.min(r1.w * r1.h, r2.w * r2.h);
  return smallerArea > 0 ? overlapArea / smallerArea : 0;
}

function wallProjectionOverlapRatio(
  r1: PlanRect & { wall: Wall },
  r2: PlanRect & { wall: Wall }
): number {
  const horizontal = r1.wall === "TOP" || r1.wall === "BOTTOM";
  const aStart = horizontal ? r1.x : r1.y;
  const aEnd = aStart + (horizontal ? r1.w : r1.h);
  const bStart = horizontal ? r2.x : r2.y;
  const bEnd = bStart + (horizontal ? r2.w : r2.h);
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const smaller = Math.min(aEnd - aStart, bEnd - bStart);
  return smaller > 0 ? overlap / smaller : 0;
}

function alignShapeCenterOnAxis(
  moving: PlanRect & { wall: Wall },
  target: PlanRect & { wall: Wall },
  bounds: { ix: number; iy: number; iw: number; ih: number }
) {
  if (moving.wall === "TOP" || moving.wall === "BOTTOM") {
    moving.x = clamp(
      target.x + target.w / 2 - moving.w / 2,
      bounds.ix,
      bounds.ix + bounds.iw - moving.w
    );
    return;
  }

  moving.y = clamp(
    target.y + target.h / 2 - moving.h / 2,
    bounds.iy,
    bounds.iy + bounds.ih - moving.h
  );
}
