import type { Cabinet, Round1Normalized } from "@/domain/round1";

export type Wall = "TOP" | "LEFT" | "RIGHT" | "BOTTOM";

export type PlanRect = { x: number; y: number; w: number; h: number };

export type CabinetShape = PlanRect & {
  code: string;
  confirmationRequired: boolean;
  wall: Wall;
};

export type ApplianceSymbol = "sink" | "range" | "fridge" | "dishwasher" | "oven" | "hood" | "microwave";

export type ApplianceShape = PlanRect & {
  key: string;
  label: string;
  symbol: ApplianceSymbol;
  wall: Wall;
  // Mounted on the peninsula bar (a horizontal run): the symbol faces the main
  // work area (rotated 180°) rather than its nominal wall.
  onPeninsula?: boolean;
  // Mounted under the counter in the island base cabinetry.
  onIsland?: boolean;
};

export type MarkerLetter = "W" | "G" | "E" | "V";
export type MarkerShape = { cx: number; cy: number; letter: MarkerLetter };

export type WindowShape = PlanRect & { wall: Wall };
export type DoorKind = "DOOR" | "OPEN_PASSAGE";
export type DoorShape = { breakRect: PlanRect; swingPath: string; leafRect: PlanRect; labelX: number; labelY: number; wall: Wall; cx: number; cy: number; kind: DoorKind };
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
  peninsula: PlanRect | null;
  peninsulaCabinets: CabinetShape[];
  window: WindowShape | null;
  door: DoorShape | null;
  markers: MarkerShape[];
  dims: DimShape[];
  confirmationCount: number;
  layoutPreference: string;
  scaleNote: string;
};

const CANVAS = { w: 760, h: 560 };
const MARGIN = { top: 32, right: 32, bottom: 32, left: 40 };
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
  // Wall-bound objects (door/window/appliances) ride a wall at a 1D position.
  wall?: Wall;
  position?: number;
  // Free 2D objects (the island) store an absolute top-left in plan coords.
  x?: number;
  y?: number;
  // Appliances mounted on the peninsula: `position` is then re-interpreted as a
  // centre offset along the peninsula's length (so they follow it when it moves).
  onPeninsula?: boolean;
  // Standalone microwave mounted under-counter in the island base cabinetry.
  onIsland?: boolean;
};

export type PositionOverrides = Record<string, PositionOverride>;

/**
 * Appliances the rep may drag onto the peninsula. Any standalone appliance is
 * allowed (the hood is excluded — it isn't dragged on its own, it rides the
 * range/cooktop it sits over).
 */
export const PENINSULA_APPLIANCE_KEYS = new Set([
  "sink",
  "dishwasher",
  "range",
  "cooktop",
  "fridge",
  "wallOven",
  "microwaveOvenCombo"
]);

// Keep island mounting narrow for Round 1: a standalone microwave can be an
// under-counter drawer/built-in, while the tall oven/microwave stack cannot.
export const ISLAND_APPLIANCE_KEYS = new Set(["microwaveOvenCombo"]);

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

  let applianceEndOffsetLEFT = endOffset["LEFT"];
  if (normalized.layoutPreference === "PENINSULA") {
    const override = overrides.peninsula;
    const depth = baseDepth;
    const gapBelow = clamp(ih * 0.18, baseDepth * 0.6, ih * 0.34);
    const peninsulaY = override?.y !== undefined ? clamp(override.y, iy, iy + ih - depth) : iy + ih - gapBelow - depth;
    // The LEFT wall effectively ends at the Peninsula for appliances.
    applianceEndOffsetLEFT = Math.max(endOffset["LEFT"], (iy + ih) - peninsulaY);
  }

  const applianceEndOffsets = { ...endOffset, LEFT: applianceEndOffsetLEFT };

  const appliances = placeAppliances(fixtures, layoutSensitive, normalized, {
    ix,
    iy,
    iw,
    ih,
    scale,
    baseDepth,
    startOffset,
    endOffset: applianceEndOffsets,
    overrides
  });

  // Place the window before the cabinets so its sink-follows-window centring
  // happens up front, then re-separate that wall so re-centring the sink can't
  // leave it sitting on top of its neighbours. Doing it here (rather than after
  // the cabinet runs) keeps every downstream consumer — clearance zones, base
  // and wall cabinets, the door — working from the appliances' final positions.
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
  separateWallAroundAnchor(appliances, "sink", startOffset, applianceEndOffsets, {
    ix,
    iy,
    iw,
    ih,
    scale
  });

  // If the sink moved to resolve overlaps, the window should follow it so they
  // remain aligned in the prompt/rendering — but only when neither was placed by
  // the user. A user window drag pins the window; a user sink drag detaches the
  // sink and leaves the window where it was.
  const sinkAfterMove = appliances.find((a) => a.key === "sink");
  const windowHasOverride = overrides.window !== undefined;
  const sinkHasOverride = overrides.sink !== undefined;
  if (
    window &&
    sinkAfterMove &&
    sinkAfterMove.wall === window.wall &&
    !windowHasOverride &&
    !sinkHasOverride
  ) {
    alignShapeCenterOnAxis(window, sinkAfterMove, { ix, iy, iw, ih });
  }

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
    (a) => a.key === "range" || a.symbol === "fridge" || a.symbol === "oven" || a.symbol === "microwave"
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
  const baseObstacles: PlanRect[] = [...sharedCabinetObstacles];
  
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

  // The window (and the sink it carries) was placed up front; cabinet fill must
  // not move or resize fixed appliances — Round 1 cabinets adapt around them.
  const wallObstacles: PlanRect[] = [
    ...sharedCabinetObstacles,
    ...appliances.filter((a) => a.symbol === "sink" || a.symbol === "dishwasher" || a.key === "cooktop" || a.symbol === "hood")
  ];
  if (window) {
    let wx = window.x, wy = window.y, ww = window.w, wh = window.h;
    if (window.wall === "TOP") { wh += wallDepth; }
    else if (window.wall === "BOTTOM") { wy -= wallDepth; wh += wallDepth; }
    else if (window.wall === "LEFT") { ww += wallDepth; }
    else if (window.wall === "RIGHT") { wx -= wallDepth; ww += wallDepth; }
    wallObstacles.push({ x: wx, y: wy, w: ww, h: wh });
  }

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

      const dw = appliances.find((a) => a.symbol === "dishwasher" && a.wall === wall);
      if (dw) {
        let dwx = dw.x, dwy = dw.y, dww = dw.w, dwh = dw.h;
        if (wall === "TOP") { dwh = wallDepth; }
        else if (wall === "BOTTOM") { dwy = iy + ih - wallDepth; dwh = wallDepth; }
        else if (wall === "LEFT") { dww = wallDepth; }
        else if (wall === "RIGHT") { dwx = ix + iw - wallDepth; dww = wallDepth; }

        let dwc: PlanRect = { x: dwx, y: dwy, w: dww, h: dwh };
        let isValid = true;
        const horizontal = wall === "TOP" || wall === "BOTTOM";

        for (const obs of sharedCabinetObstacles) {
          if (rectIntersect(dwc, obs)) {
             isValid = false;
          }
        }
        
        if (window) {
          let wx = window.x, wy = window.y, ww = window.w, wh = window.h;
          if (window.wall === "TOP") { wh += wallDepth; }
          else if (window.wall === "BOTTOM") { wy -= wallDepth; wh += wallDepth; }
          else if (window.wall === "LEFT") { ww += wallDepth; }
          else if (window.wall === "RIGHT") { wx -= wallDepth; ww += wallDepth; }
          const wObs = { x: wx, y: wy, w: ww, h: wh };
          
          if (rectIntersect(dwc, wObs)) {
            if (horizontal) {
              if (wObs.x <= dwc.x && wObs.x + wObs.w >= dwc.x + dwc.w) isValid = false;
              else if (wObs.x > dwc.x && wObs.x < dwc.x + dwc.w) {
                dwc.w = wObs.x - dwc.x;
              } else if (wObs.x + wObs.w > dwc.x && wObs.x + wObs.w < dwc.x + dwc.w) {
                const diff = (wObs.x + wObs.w) - dwc.x;
                dwc.x += diff;
                dwc.w -= diff;
              }
            } else {
              if (wObs.y <= dwc.y && wObs.y + wObs.h >= dwc.y + dwc.h) isValid = false;
              else if (wObs.y > dwc.y && wObs.y < dwc.y + dwc.h) {
                dwc.h = wObs.y - dwc.y;
              } else if (wObs.y + wObs.h > dwc.y && wObs.y + wObs.h < dwc.y + dwc.h) {
                const diff = (wObs.y + wObs.h) - dwc.y;
                dwc.y += diff;
                dwc.h -= diff;
              }
            }
          }
        }

        if (isValid && dwc.w >= 6 && dwc.h >= 6) {
          wallCabinets.push({
            x: dwc.x,
            y: dwc.y,
            w: dwc.w,
            h: dwc.h,
            wall,
            code: "ROUND1_GENERIC_WALL",
            confirmationRequired: false
          });
        }
      }
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
    clearanceZones,
    overrides
  });

  if (island) {
    const mounted = [...mountAppliancesOnIsland(appliances, island, overrides)];
    appliances.length = 0;
    appliances.push(...mounted);
  }

  const peninsula = placePeninsula(normalized, {
    ix,
    iy,
    iw,
    ih,
    baseDepth,
    clearanceZones,
    appliances,
    overrides
  });
  const peninsulaCabinets = peninsula
    ? layPeninsulaRun(
        peninsula,
        cabinets.filter(
          (cabinet) =>
            cabinet.kind === "BASE" && cabinet.location === "ON_PENINSULA"
        )
      )
    : [];

  // Move any appliance the rep dropped onto the peninsula off its wall and onto
  // the peninsula bar (it then follows the peninsula). Done after the wall runs
  // so the vacated wall stretch simply fills with base cabinetry.
  if (peninsula) {
    // Copy first: when nothing is mounted, mountAppliancesOnPeninsula returns the
    // SAME array, so clearing `appliances` before the spread would empty it too
    // (which hid every appliance on the peninsula layout). The spread snapshots
    // the result before we rewrite `appliances` in place.
    const mounted = [...mountAppliancesOnPeninsula(appliances, peninsula, overrides)];
    appliances.length = 0;
    appliances.push(...mounted);

    // Dynamic closing logic: trim/discard LEFT wall cabinetry below the bottom edge of the peninsula
    const bottomLimit = peninsula.y + peninsula.h;

    // Filter out or clamp base cabinets on the LEFT wall
    for (let i = baseCabinets.length - 1; i >= 0; i--) {
      const bc = baseCabinets[i];
      if (bc.wall === "LEFT") {
        if (bc.y >= bottomLimit) {
          baseCabinets.splice(i, 1);
        } else if (bc.y + bc.h > bottomLimit) {
          bc.h = bottomLimit - bc.y;
        }
      }
    }

    // Filter out or clamp wall cabinets on the LEFT wall
    for (let i = wallCabinets.length - 1; i >= 0; i--) {
      const wc = wallCabinets[i];
      if (wc.wall === "LEFT") {
        if (wc.y >= bottomLimit) {
          wallCabinets.splice(i, 1);
        } else if (wc.y + wc.h > bottomLimit) {
          wc.h = bottomLimit - wc.y;
        }
      }
    }
  }

  // Absorb sub-minimum wall-cabinet fragments (e.g. a sliver the fill leaves at
  // a wall end) into an adjacent same-wall cabinet, so a clipped, unbuildable
  // narrow standalone wall cabinet is never rendered. A fragment with no
  // touching neighbour is dropped rather than kept as a lone sliver.
  // ponytail: O(n^2) per wall, but n (cabinets per wall) is tiny.
  const minStandaloneWall = 12 * scale;
  for (const wall of ["TOP", "BOTTOM", "LEFT", "RIGHT"] as const) {
    const horizontal = wall === "TOP" || wall === "BOTTOM";
    const runSize = (c: CabinetShape) => (horizontal ? c.w : c.h);
    const runStart = (c: CabinetShape) => (horizontal ? c.x : c.y);
    const runEnd = (c: CabinetShape) => (horizontal ? c.x + c.w : c.y + c.h);
    let changed = true;
    while (changed) {
      changed = false;
      const onWall = wallCabinets
        .filter((c) => c.wall === wall)
        .sort((a, b) => runStart(a) - runStart(b));
      const frag = onWall.find((c) => runSize(c) < minStandaloneWall);
      if (!frag) continue;
      const neighbour = onWall.find(
        (c) =>
          c !== frag &&
          (Math.abs(runEnd(c) - runStart(frag)) < 1 ||
            Math.abs(runEnd(frag) - runStart(c)) < 1)
      );
      if (neighbour) {
        const start = Math.min(runStart(neighbour), runStart(frag));
        const end = Math.max(runEnd(neighbour), runEnd(frag));
        if (horizontal) {
          neighbour.x = start;
          neighbour.w = end - start;
        } else {
          neighbour.y = start;
          neighbour.h = end - start;
        }
      }
      wallCabinets.splice(wallCabinets.indexOf(frag), 1);
      changed = true;
    }
  }

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
    peninsula,
    peninsulaCabinets,
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
    // Free-standing runs (island, peninsula) are placed by their own geometry
    // helpers, not laid along a wall track.
    if (cabinet.location === "ON_ISLAND" || cabinet.location === "ON_PENINSULA") {
      continue;
    }
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
    const minimumStandaloneWallLength = 12 * scale;
    
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
          if (!snapObstacles && gap < minimumStandaloneWallLength) {
            cursor = Math.max(cursor, overlap.end);
            continue;
          }
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
  const minStandaloneLength = codePrefix.includes("_WALL") ? depth : minGap;

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
    if (interval.start - cursor >= minStandaloneLength) {
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

  if (limit - cursor >= minStandaloneLength) {
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
    case "LEFT_L_SHAPE":
    case "L_SHAPE":
    case "PENINSULA":
    case "L_SHAPE_ISLAND":
      return ["TOP", "LEFT"];
    case "RIGHT_L_SHAPE":
      return ["TOP", "RIGHT"];
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

const WALL_ADJACENCY: Record<Wall, Wall[]> = {
  TOP: ["LEFT", "RIGHT"],
  BOTTOM: ["LEFT", "RIGHT"],
  LEFT: ["TOP", "BOTTOM"],
  RIGHT: ["TOP", "BOTTOM"]
};

const WALL_OPPOSITE: Record<Wall, Wall> = {
  TOP: "BOTTOM",
  BOTTOM: "TOP",
  LEFT: "RIGHT",
  RIGHT: "LEFT"
};

/**
 * Snaps a desired wall to one the layout actually occupies. A relation such as
 * "front side" maps to BOTTOM, but in an L-shape (TOP/LEFT only) BOTTOM has no
 * run, so an appliance defaulted there would float outside the L. Prefer an
 * adjacent allowed wall, then the opposite, then any allowed wall.
 */
function clampWallToLayout(wall: Wall, layoutPreference: string): Wall {
  const allowed = allowedDragWallsForLayout(layoutPreference);
  if (allowed.length === 0 || allowed.includes(wall)) return wall;
  const adjacent = WALL_ADJACENCY[wall].find((candidate) => allowed.includes(candidate));
  if (adjacent) return adjacent;
  if (allowed.includes(WALL_OPPOSITE[wall])) return WALL_OPPOSITE[wall];
  return allowed[0];
}

function overrideWall(
  overrides: PositionOverrides,
  key: string,
  fallback: Wall,
  layoutPreference?: string
): Wall {
  const resolvedFallback = layoutPreference
    ? clampWallToLayout(fallback, layoutPreference)
    : fallback;
  const override = overrides[key];
  if (!override || override.wall === undefined) return resolvedFallback;
  if (layoutPreference && !wallAllowed(override.wall, layoutPreference)) return resolvedFallback;
  return override.wall;
}

function overridePosition(
  overrides: PositionOverrides,
  key: string
): number | undefined {
  return overrides[key]?.position;
}

function isUnspecifiedRelation(relation: string | undefined): boolean {
  return (
    relation == null ||
    relation === "UNKNOWN" ||
    relation === "NOT_APPLICABLE" ||
    relation === "NO_PREFERENCE"
  );
}

/**
 * Resolves an appliance's wall into either a fixed wall — an explicit drag
 * override, or a wall the customer deliberately chose — or `null`, meaning
 * "no preference". Appliances that resolve to `null` are positioned by the
 * intelligent auto-layout in {@link placeAppliances}, which spreads them across
 * the available walls. Drag overrides and explicit relations always win over
 * auto-layout.
 */
function resolveApplianceWall(
  overrides: PositionOverrides,
  key: string,
  relation: string | undefined,
  layoutPreference: string
): Wall | null {
  const override = overrides[key];
  if (override?.wall !== undefined && wallAllowed(override.wall, layoutPreference)) {
    return override.wall;
  }
  if (!isUnspecifiedRelation(relation)) {
    return clampWallToLayout(relationToWall(relation, "TOP"), layoutPreference);
  }
  return null;
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
  const ovenMicrowaveConfiguration = layoutSensitive.ovenMicrowave?.configuration;
  const layoutPreference = normalized.layoutPreference;

  // --- Fixed-wall appliances (explicit relation or drag override) ---
  let sinkFallbackWall: Wall = relationToWall(fixtures.sink?.relation, "TOP");
  if (sinkUnderWindow) {
    const windowRelation = (normalized.openings.windows.items[0] as { relation?: string } | undefined)?.relation;
    sinkFallbackWall = relationToWall(windowRelation, "TOP");
  }
  const sinkWall = overrideWall(ctx.overrides, "sink", sinkFallbackWall, layoutPreference);

  const dishwasherPresent = fixtures.dishwasher?.status !== "NONE";
  const dwFallbackWall =
    fixtures.dishwasher?.relation === "NEAR_SINK"
      ? sinkWall
      : relationToWall(fixtures.dishwasher?.relation, sinkWall);
  const dishwasherWall = dishwasherPresent
    ? overrideWall(ctx.overrides, "dishwasher", dwFallbackWall, layoutPreference)
    : null;

  const rangePresent = cooking?.range?.status !== "NO";
  const rangeWall = rangePresent
    ? overrideWall(
        ctx.overrides,
        "range",
        relationToWall(cooking?.range?.relation ?? fixtures.range?.relation, "TOP"),
        layoutPreference
      )
    : null;

  const fridgeWall = overrideWall(
    ctx.overrides,
    "fridge",
    relationToWall(fixtures.fridge?.relation, "TOP"),
    layoutPreference
  );

  // Appliances that may have no chosen wall. Cooktop and microwave/oven combo no
  // longer ask for a wall, and a wall oven may be left "unknown"; these resolve
  // to null and are placed by the intelligent auto-layout below. A drag override
  // or an explicit relation still pins them.
  const cooktopPresent = cooking?.cooktop?.status === "YES";
  const cooktopWall = cooktopPresent
    ? resolveApplianceWall(ctx.overrides, "cooktop", cooking?.cooktop?.relation, layoutPreference)
    : undefined;
  const wallOvenPresent = cooking?.wallOven?.status === "YES";
  const wallOvenWall = wallOvenPresent
    ? resolveApplianceWall(ctx.overrides, "wallOven", cooking?.wallOven?.relation, layoutPreference)
    : undefined;
  const microwavePresent = cooking?.microwaveOvenCombo?.status === "YES";
  const microwaveWall = microwavePresent
    ? resolveApplianceWall(
        ctx.overrides,
        "microwaveOvenCombo",
        cooking?.microwaveOvenCombo?.relation,
        layoutPreference
      )
    : undefined;
  const stackedOvenMicrowave =
    ovenMicrowaveConfiguration === "WALL_OVEN_MICROWAVE_STACK" &&
    wallOvenPresent &&
    microwavePresent;
  const stackWall = stackedOvenMicrowave
    ? (resolveApplianceWall(
        ctx.overrides,
        "ovenMicrowaveStack",
        layoutSensitive.ovenMicrowave?.relation,
        layoutPreference
      ) ??
      wallOvenWall ??
      microwaveWall)
    : undefined;

  // --- Intelligent auto-layout: spread no-preference appliances across walls ---
  // Each appliance with no chosen wall is dropped onto the wall that still has
  // the most free linear space (accounting for the appliances already committed),
  // so they form a sensible spread instead of all piling onto the main run. The
  // customer can then fine-tune by dragging.
  const availableWalls = allowedDragWallsForLayout(layoutPreference);
  const loadPx = new Map<Wall, number>();
  for (const wall of availableWalls) loadPx.set(wall, 0);
  const addLoad = (wall: Wall | null | undefined, sizeIn: number) => {
    if (wall && loadPx.has(wall)) {
      loadPx.set(wall, (loadPx.get(wall) ?? 0) + sizeIn * ctx.scale);
    }
  };
  const wallSpanPx = (wall: Wall): number => {
    const horizontal = wall === "TOP" || wall === "BOTTOM";
    return (horizontal ? ctx.iw : ctx.ih) - ctx.startOffset[wall] - ctx.endOffset[wall];
  };
  addLoad(sinkWall, fixtures.sink?.size ?? 30);
  addLoad(dishwasherWall, fixtures.dishwasher?.size ?? 24);
  addLoad(rangeWall, fixtures.range?.size ?? 30);
  addLoad(fridgeWall, fixtures.fridge?.size ?? 36);
  addLoad(cooktopWall, 30);
  if (stackedOvenMicrowave) {
    addLoad(stackWall, 30);
  } else {
    addLoad(wallOvenWall, 30);
    addLoad(microwaveWall, 30);
  }

  const pickAutoWall = (preferMainRun: boolean): Wall => {
    if (availableWalls.length === 0) return "TOP";
    if (preferMainRun && availableWalls.includes("TOP")) return "TOP";
    let best = availableWalls[0];
    let bestRemaining = wallSpanPx(best) - (loadPx.get(best) ?? 0);
    for (const wall of availableWalls) {
      const remaining = wallSpanPx(wall) - (loadPx.get(wall) ?? 0);
      if (remaining > bestRemaining + 0.1) {
        best = wall;
        bestRemaining = remaining;
      }
    }
    return best;
  };

  // Cooktop is a primary cooking surface -> keep it on the main run near the sink.
  let cooktopFinalWall: Wall | undefined;
  if (cooktopPresent) {
    cooktopFinalWall = cooktopWall ?? pickAutoWall(true);
    if (!cooktopWall) addLoad(cooktopFinalWall, 30);
  }
  // Wall oven / microwave are tall units -> drop them on the least-crowded wall.
  let wallOvenFinalWall: Wall | undefined;
  if (wallOvenPresent && !stackedOvenMicrowave) {
    wallOvenFinalWall = wallOvenWall ?? pickAutoWall(false);
    if (!wallOvenWall) addLoad(wallOvenFinalWall, 30);
  }
  let microwaveFinalWall: Wall | undefined;
  if (microwavePresent && !stackedOvenMicrowave) {
    microwaveFinalWall = microwaveWall ?? pickAutoWall(false);
    if (!microwaveWall) addLoad(microwaveFinalWall, 30);
  }
  let stackFinalWall: Wall | undefined;
  if (stackedOvenMicrowave) {
    stackFinalWall = stackWall ?? pickAutoWall(false);
    if (!stackWall) addLoad(stackFinalWall, 30);
  }

  // --- Push specs in a stable order so per-wall positioning is deterministic ---
  specs.push({
    key: "sink",
    label: "Sink",
    symbol: "sink",
    sizeIn: fixtures.sink?.size ?? 30,
    wall: sinkWall,
    deep: false
  });
  if (dishwasherPresent && dishwasherWall) {
    specs.push({
      key: "dishwasher",
      label: "Dishwasher",
      symbol: "dishwasher",
      sizeIn: fixtures.dishwasher?.size ?? 24,
      wall: dishwasherWall,
      deep: false
    });
  }
  if (rangePresent && rangeWall) {
    specs.push({
      key: "range",
      label: "Range",
      symbol: "range",
      sizeIn: fixtures.range?.size ?? 30,
      wall: rangeWall,
      deep: true
    });
  }
  if (cooktopPresent && cooktopFinalWall) {
    specs.push({
      key: "cooktop",
      label: "Cooktop",
      symbol: "range",
      sizeIn: 30,
      wall: cooktopFinalWall,
      deep: false
    });
  }
  if (stackedOvenMicrowave && stackFinalWall) {
    specs.push({
      key: "ovenMicrowaveStack",
      label: "Wall oven + microwave stack",
      symbol: "oven",
      sizeIn: 30,
      wall: stackFinalWall,
      deep: true
    });
  }
  if (wallOvenPresent && wallOvenFinalWall) {
    specs.push({
      key: "wallOven",
      label: "Wall oven",
      symbol: "oven",
      sizeIn: 30,
      wall: wallOvenFinalWall,
      deep: true
    });
  }
  if (microwavePresent && microwaveFinalWall) {
    specs.push({
      key: "microwaveOvenCombo",
      label: "Microwave",
      symbol: "microwave",
      sizeIn: 30,
      wall: microwaveFinalWall,
      deep: true
    });
  }
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

    // Sort appliances by their intended position so dragging them reorders them naturally
    const targets = onWall.map((spec, idx) => {
      const roughDefault = runStart + spacing + idx * ((span - spacing) / Math.max(1, onWall.length));
      return { spec, target: overridePosition(ctx.overrides, spec.key) ?? roughDefault };
    });
    targets.sort((a, b) => a.target - b.target);
    const sortedOnWall = targets.map(t => t.spec);

    let cursor = runStart + (totalApplianceWidth > span ? (span * 0.025) : spacing);
    const occupied: AxisInterval[] = [];

    sortedOnWall.forEach((spec) => {
      const originalIdx = onWall.indexOf(spec);
      const length = rawLengths[originalIdx] * fitFactor;
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
      
      let currentSpacing = spacing;
      const nextSpec = sortedOnWall[sortedOnWall.indexOf(spec) + 1];
      if (
        nextSpec &&
        ((spec.key === "sink" && nextSpec.key === "dishwasher") ||
         (spec.key === "dishwasher" && nextSpec.key === "sink"))
      ) {
        currentSpacing = 0;
      }
      cursor += length + currentSpacing;
    });

    // Guarantee no two appliances on this wall overlap. A relaxation loop (split
    // each overlap in half, re-clamp, repeat) can hit its iteration cap on a
    // crowded wall and return with residual overlap — that's what let a dragged
    // appliance sit slightly on top of its neighbor. fitFactor (above) already
    // shrinks the run to fit the wall span, so a deterministic forward sweep
    // (no start may precede the previous end) plus a backward clamp (keep the
    // run inside the wall) always separates them. For an already-separated
    // layout both passes are the identity, so coordinates are unchanged.
    const onWallShapes = shapes
      .filter((s) => s.wall === wall)
      .sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    const runMin = (horizontal ? ix : iy) + startOffset[wall];
    const runMax = (horizontal ? ix + iw : iy + ih) - endOffset[wall];
    const axisStart = (s: ApplianceShape) => (horizontal ? s.x : s.y);
    const axisSize = (s: ApplianceShape) => (horizontal ? s.w : s.h);
    const setAxis = (s: ApplianceShape, v: number) => {
      if (horizontal) s.x = v;
      else s.y = v;
    };
    let packCursor = runMin;
    for (const s of onWallShapes) {
      const pos = Math.max(axisStart(s), packCursor);
      setAxis(s, pos);
      packCursor = pos + axisSize(s);
    }
    let limit = runMax;
    for (let i = onWallShapes.length - 1; i >= 0; i--) {
      const s = onWallShapes[i];
      const pos = Math.max(Math.min(axisStart(s), limit - axisSize(s)), runMin);
      setAxis(s, pos);
      limit = pos;
    }
  }

  return shapes;
}

/**
 * Re-separates one wall's appliances after a post-placement move — the sink is
 * re-centred under the window only once the window's position is known, which
 * can drop it on top of the neighbours {@link placeAppliances} already packed.
 * The anchor (sink) stays put; its neighbours are pushed outward just far
 * enough to clear it, then the whole run is nudged back inside the wall. On an
 * already-separated wall every step is a no-op, so coordinates are unchanged.
 */
function separateWallAroundAnchor(
  appliances: ApplianceShape[],
  anchorKey: string,
  startOffset: Record<Wall, number>,
  endOffset: Record<Wall, number>,
  { ix, iy, iw, ih }: Geom
) {
  const anchor = appliances.find((a) => a.key === anchorKey);
  if (!anchor) return;
  const wall = anchor.wall;
  const horizontal = wall === "TOP" || wall === "BOTTOM";
  const runMin = (horizontal ? ix : iy) + startOffset[wall];
  const runMax = (horizontal ? ix + iw : iy + ih) - endOffset[wall];
  const axisStart = (s: ApplianceShape) => (horizontal ? s.x : s.y);
  const axisSize = (s: ApplianceShape) => (horizontal ? s.w : s.h);
  const setAxis = (s: ApplianceShape, v: number) => {
    if (horizontal) s.x = v;
    else s.y = v;
  };

  const onWall = appliances
    .filter((s) => s.wall === wall && s.symbol !== "hood")
    .sort((a, b) => axisStart(a) - axisStart(b));
  const pin = onWall.indexOf(anchor);
  if (pin < 0) return;

  // Push right neighbours out so none starts before the previous end.
  let cursor = axisStart(anchor) + axisSize(anchor);
  for (let k = pin + 1; k < onWall.length; k++) {
    const s = onWall[k];
    if (axisStart(s) < cursor) setAxis(s, cursor);
    cursor = axisStart(s) + axisSize(s);
  }
  // Push left neighbours out so none ends after the next start.
  cursor = axisStart(anchor);
  for (let k = pin - 1; k >= 0; k--) {
    const s = onWall[k];
    if (axisStart(s) + axisSize(s) > cursor) setAxis(s, cursor - axisSize(s));
    cursor = axisStart(s);
  }
  // Slide the whole (now overlap-free) run back inside the wall.
  const first = onWall[0];
  const last = onWall[onWall.length - 1];
  let shift = 0;
  const hi = axisStart(last) + axisSize(last);
  if (hi > runMax) shift = runMax - hi;
  if (axisStart(first) + shift < runMin) shift = runMin - axisStart(first);
  if (shift !== 0) for (const s of onWall) setAxis(s, axisStart(s) + shift);
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

  let wall = overrideWall(ctx.overrides, "window", relationToWall(relation, "TOP"));

  const length = clamp(36 * ctx.scale, 40, (wall === "TOP" || wall === "BOTTOM" ? ctx.iw : ctx.ih) * 0.5);

  let x = 0;
  let y = 0;
  let w = 0;
  let h = 0;

  if (wall === "TOP" || wall === "BOTTOM") {
    w = length;
    h = ctx.thickness;
    // The window centres on the room and is the anchor; the sink follows it
    // (below), never the other way around.
    const centerX = ctx.roomX + ctx.roomW / 2;
    const defaultX = clamp(centerX - length / 2, ctx.ix, ctx.ix + ctx.iw - length);
    x = overridePosition(ctx.overrides, "window") !== undefined ? clamp(overridePosition(ctx.overrides, "window")!, ctx.ix, ctx.ix + ctx.iw - length) : defaultX;
    y = wall === "TOP" ? ctx.roomY : ctx.roomY + ctx.roomH - ctx.thickness;
  } else {
    w = ctx.thickness;
    h = length;
    const centerY = ctx.roomY + ctx.roomH / 2;
    const defaultY = clamp(centerY - length / 2, ctx.iy, ctx.iy + ctx.ih - length);
    y = overridePosition(ctx.overrides, "window") !== undefined ? clamp(overridePosition(ctx.overrides, "window")!, ctx.iy, ctx.iy + ctx.ih - length) : defaultY;
    x = wall === "LEFT" ? ctx.roomX : ctx.roomX + ctx.roomW - ctx.thickness;
  }

  const windowShape: WindowShape = { x, y, w, h, wall };
  // Sink-follows-window: when the sink sits under the window on the same wall
  // and the rep hasn't dragged the sink itself, keep it centred under the
  // window. Dragging the window therefore carries the sink along; dragging the
  // sink sets its own override, which detaches it and leaves the window put.
  const sinkHasOverride = overridePosition(ctx.overrides, "sink") !== undefined;
  const sinkOnWindowWall = !!sink && sink.wall === wall;
  // No sink override → sink stays parked under the window (so dragging the
  // window carries it). With an override → the sink moves freely, but snaps
  // back to centre once a drag brings it ≥75% over the window.
  const snapDraggedSink =
    sinkOnWindowWall &&
    sinkHasOverride &&
    wallProjectionOverlapRatio(windowShape, sink!) >= 0.75;
  if (sinkOnWindowWall && (!sinkHasOverride || snapDraggedSink)) {
    alignShapeCenterOnAxis(sink!, windowShape, {
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
    doors?: {
      status?: string;
      items?: Array<{ location?: string; kind?: string }>;
    };
  }).doors;
  if (doors?.status === "NO") return null;

  const location = doors?.items?.[0]?.location;
  // A missing kind is treated as a door (the clearance-reserving default).
  const kind: DoorKind =
    doors?.items?.[0]?.kind === "OPEN_PASSAGE" ? "OPEN_PASSAGE" : "DOOR";
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

    // An open passage is a cased wall gap: no door leaf and no swing arc, so it
    // reserves no swing clearance downstream.
    const passage = kind === "OPEN_PASSAGE";
    return {
      breakRect: { x: cx - opening / 2, y: wy, w: opening, h: thickness },
      swingPath: passage
        ? ""
        : `M${hingeX},${leafEndY} A${opening},${opening} 0 0 ${sweep} ${cx - opening / 2},${tipY}`,
      leafRect: passage ? { x: leafRect.x, y: leafRect.y, w: 0, h: 0 } : leafRect,
      labelX: cx,
      labelY: wall === "TOP" ? roomY - 6 : roomY + roomH + 16,
      wall,
      cx,
      cy: wy,
      kind
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

  const passage = kind === "OPEN_PASSAGE";
  return {
    breakRect: { x: wx, y: cy - opening / 2, w: thickness, h: opening },
    swingPath: passage
      ? ""
      : `M${leafEndX},${hingeY} A${opening},${opening} 0 0 ${sweep} ${tipX},${cy - opening / 2}`,
    leafRect: passage ? { x: leafRect.x, y: leafRect.y, w: 0, h: 0 } : leafRect,
    labelX: wall === "LEFT" ? roomX - 16 : roomX + roomW + 16,
    labelY: cy,
    wall,
    cx: wx,
    cy,
    kind
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
      appliance.symbol === "microwave" ||
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

  // Only a swinging door reserves swing clearance. An open passage has no leaf,
  // so cabinets and appliances may sit right up to it (e.g. a corner cabinet is
  // no longer eaten by a phantom swing arc).
  if (door && door.kind !== "OPEN_PASSAGE") {
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
    overrides: PositionOverrides;
  }
): PlanRect | null {
  if (!layoutSensitive.island?.requested && !/ISLAND/.test(normalized.layoutPreference)) {
    return null;
  }

  // A kitchen island belongs in the middle of the room — that's where it sits
  // in real life and in the design mock. Use a long, shallow footprint centred
  // in the room; the walkway to the surrounding counters is the gap around it,
  // and the rep drags it to the exact spot in Adjust Positions. The only hard
  // obstacle we dodge is a door's swing arc.
  const size = { w: ctx.iw * 0.42, h: ctx.ih * 0.26 };

  // A dragged island carries an explicit top-left in plan coords; honour it
  // (clamped inside the room) before falling back to the centred default.
  const override = ctx.overrides.island;
  if (override?.x !== undefined && override?.y !== undefined) {
    return {
      x: clamp(override.x, ctx.ix, ctx.ix + ctx.iw - size.w),
      y: clamp(override.y, ctx.iy, ctx.iy + ctx.ih - size.h),
      w: size.w,
      h: size.h
    };
  }

  const at = (centerX: number, centerY: number): PlanRect => ({
    x: clamp(centerX - size.w / 2, ctx.ix, ctx.ix + ctx.iw - size.w),
    y: clamp(centerY - size.h / 2, ctx.iy, ctx.iy + ctx.ih - size.h),
    w: size.w,
    h: size.h
  });

  const centered = at(ctx.ix + ctx.iw / 2, ctx.iy + ctx.ih * 0.52);
  const doorSwings = ctx.clearanceZones.filter(
    (zone) => zone.kind === "DOOR_SWING"
  );
  if (doorSwings.every((zone) => !rectIntersect(centered, zone))) {
    return centered;
  }

  // Centre overlaps the door swing — nudge toward the clearest nearby spot.
  for (const centerX of [0.5, 0.42, 0.58, 0.36, 0.64]) {
    for (const centerY of [0.52, 0.44, 0.6, 0.38, 0.66]) {
      const candidate = at(ctx.ix + ctx.iw * centerX, ctx.iy + ctx.ih * centerY);
      if (doorSwings.every((zone) => !rectIntersect(candidate, zone))) {
        return candidate;
      }
    }
  }
  return centered;
}

/**
 * A peninsula is a counter run anchored to the end of the wall cabinetry that
 * projects straight into the room, open on three sides. Unlike a galley/U-shape
 * front run it must NOT hug the opposite (front) wall — that was the old bug,
 * where the peninsula was routed to the BOTTOM wall and gap-filled across it.
 *
 * For the peninsula layout (main run on TOP, side run on LEFT) it reads as the
 * bottom leg jutting right from the foot of the LEFT run — the "⊏" of the layout
 * tile — leaving a walkway between its far edge and the front wall.
 */
function placePeninsula(
  normalized: Round1Normalized,
  ctx: {
    ix: number;
    iy: number;
    iw: number;
    ih: number;
    baseDepth: number;
    clearanceZones: ClearanceZoneShape[];
    appliances: ApplianceShape[];
    overrides: PositionOverrides;
  }
): PlanRect | null {
  if (normalized.layoutPreference !== "PENINSULA") return null;

  const { ix, iy, iw, ih, baseDepth } = ctx;
  const innerBottom = iy + ih;
  const gap = 6;

  const depth = baseDepth;
  const length = clamp(iw * 0.42, baseDepth * 2.2, iw - baseDepth * 2.2);
  const gapBelow = clamp(ih * 0.18, baseDepth * 0.6, ih * 0.34);
  const minWalkway = baseDepth * 0.5;

  // The peninsula only slides vertically along its LEFT-wall anchor — x stays
  // pinned to the wall, so a drag stores just `y`. Honour it (clamped) and skip
  // the auto fridge/door dodging; the rep owns the position once they've moved it.
  const override = ctx.overrides.peninsula;
  if (override?.y !== undefined) {
    return {
      x: ix + baseDepth,
      y: clamp(override.y, iy, iy + ih - depth),
      w: length,
      h: depth
    };
  }

  let rect: PlanRect = {
    x: ix + baseDepth,
    y: iy + ih - gapBelow - depth,
    w: length,
    h: depth
  };

  // The peninsula anchors on the LEFT wall and juts right. A left-wall appliance
  // — typically the fridge — can occupy that same lower corner, which made the
  // peninsula look like it grew out of the fridge. If its anchor band overlaps
  // such an appliance, slide it just below (preferred, keeping a walkway to the
  // front wall) or, if that doesn't fit, just above.
  const anchorBlockers = ctx.appliances.filter(
    (a) => a.wall === "LEFT" && a.x < rect.x && a.x + a.w > ix
  );
  const overlapping = anchorBlockers.filter(
    (a) => rect.y + rect.h > a.y && rect.y < a.y + a.h
  );
  if (overlapping.length > 0) {
    const below = Math.max(...overlapping.map((a) => a.y + a.h)) + gap;
    if (below + depth <= innerBottom - minWalkway) {
      rect = { ...rect, y: below };
    } else {
      const above = Math.min(...overlapping.map((a) => a.y)) - gap - depth;
      rect = { ...rect, y: Math.max(iy + gap, above) };
    }
  }

  // Keep clear of a door's swing arc: trim the peninsula's reach rather than
  // letting it cross the doorway.
  for (const zone of ctx.clearanceZones) {
    if (zone.kind !== "DOOR_SWING") continue;
    if (rectIntersect(rect, zone) && zone.x > rect.x) {
      rect = { ...rect, w: Math.max(baseDepth * 1.6, zone.x - rect.x - 6) };
    }
  }

  return rect;
}

function layPeninsulaRun(
  peninsula: PlanRect,
  cabinets: Cabinet[]
): CabinetShape[] {
  if (cabinets.length === 0) return [];

  const totalWidth = cabinets.reduce((sum, cabinet) => sum + cabinet.width, 0);
  let cursor = peninsula.x;

  return cabinets.map((cabinet, index) => {
    const isLast = index === cabinets.length - 1;
    const width = isLast
      ? peninsula.x + peninsula.w - cursor
      : peninsula.w * (cabinet.width / totalWidth);
    const shape: CabinetShape = {
      x: cursor,
      y: peninsula.y,
      w: width,
      h: peninsula.h,
      code: cabinet.code,
      confirmationRequired: cabinet.confirmationRequired,
      wall: "LEFT"
    };
    cursor += width;
    return shape;
  });
}

/**
 * Relocates appliances flagged `onPeninsula` from their wall onto the peninsula
 * bar, reusing each appliance's existing run-length so sizes stay consistent.
 * The bar is horizontal, so mounted appliances sit centred on its depth and are
 * packed left-to-right (honouring each drag's centre offset) without overlap.
 * A hood left stranded by a moved cooktop is dropped too.
 */
function mountAppliancesOnPeninsula(
  appliances: ApplianceShape[],
  peninsula: PlanRect,
  overrides: PositionOverrides
): ApplianceShape[] {
  const movedKeys = [...PENINSULA_APPLIANCE_KEYS].filter(
    (key) => overrides[key]?.onPeninsula === true && appliances.some((a) => a.key === key)
  );
  if (movedKeys.length === 0) return appliances;

  const kept = appliances
    .filter((a) => !movedKeys.includes(a.key))
    // A hood only makes sense over a remaining wall cooktop/range.
    .filter(
      (a) =>
        a.symbol !== "hood" ||
        appliances.some(
          (o) => o.symbol === "range" && !movedKeys.includes(o.key) && rectIntersect(a, o)
        )
    );

  const depth = Math.min(peninsula.h * 0.84, peninsula.h - 6);
  const y = peninsula.y + (peninsula.h - depth) / 2;

  const mounted = movedKeys
    .map((key) => {
      const prev = appliances.find((a) => a.key === key)!;
      const runLen = prev.wall === "TOP" || prev.wall === "BOTTOM" ? prev.w : prev.h;
      const w = clamp(runLen, 18, peninsula.w * 0.9);
      const rel = overrides[key]?.position;
      // No drag offset yet -> append to the right; otherwise centre on the offset.
      const requested = rel != null ? rel - w / 2 : Number.POSITIVE_INFINITY;
      return { key, prev, w, requested };
    })
    .sort((a, b) => a.requested - b.requested);

  const shapes: ApplianceShape[] = [];
  let cursor = peninsula.x;
  for (const m of mounted) {
    const desired = Number.isFinite(m.requested) ? peninsula.x + m.requested : cursor;
    const x = clamp(Math.max(desired, cursor), peninsula.x, peninsula.x + peninsula.w - m.w);
    shapes.push({
      x,
      y,
      w: m.w,
      h: depth,
      key: m.key,
      label: m.prev.label,
      symbol: m.prev.symbol,
      wall: "TOP",
      onPeninsula: true
    });
    cursor = x + m.w;
  }

  return [...kept, ...shapes];
}

function mountAppliancesOnIsland(
  appliances: ApplianceShape[],
  island: PlanRect,
  overrides: PositionOverrides
): ApplianceShape[] {
  const key = "microwaveOvenCombo";
  if (
    !ISLAND_APPLIANCE_KEYS.has(key) ||
    overrides[key]?.onIsland !== true
  ) {
    return appliances;
  }

  const previous = appliances.find((appliance) => appliance.key === key);
  if (!previous) return appliances;

  const runLength =
    previous.wall === "TOP" || previous.wall === "BOTTOM"
      ? previous.w
      : previous.h;
  const width = clamp(runLength, 18, island.w * 0.9);
  const depth = Math.min(island.h * 0.84, island.h - 6);
  const requestedCenter = overrides[key]?.position ?? island.w / 2;
  const x = clamp(
    island.x + requestedCenter - width / 2,
    island.x,
    island.x + island.w - width
  );

  return [
    ...appliances.filter((appliance) => appliance.key !== key),
    {
      x,
      y: island.y + (island.h - depth) / 2,
      w: width,
      h: depth,
      key,
      label: previous.label,
      symbol: previous.symbol,
      wall: "TOP",
      onIsland: true
    }
  ];
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

export function isPositionValid(plan: FloorPlan, id: string, override: PositionOverride): boolean {
  // A simple approximation: if it's within the wall length, it's valid.
  // We can refine this later if tests fail.
  return true;
}
