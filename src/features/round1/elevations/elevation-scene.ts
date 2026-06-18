import type {
  ApplianceShape,
  FloorPlan,
  PlanRect,
  Wall
} from "../floorplan/plan-geometry";

export type ElevationItemKind =
  | "baseCabinet"
  | "wallCabinet"
  | "corner"
  | "appliance"
  | "opening";

export type ElevationSymbol =
  | "baseCabinet"
  | "wallCabinet"
  | "corner"
  | "sink"
  | "range"
  | "cooktop"
  | "fridge"
  | "dishwasher"
  | "oven"
  | "hood"
  | "window"
  | "door";

export type ElevationItem = {
  key: string;
  kind: ElevationItemKind;
  symbol: ElevationSymbol;
  label: string;
  wall: Wall;
  x: number;
  y: number;
  w: number;
  h: number;
  sourceCode?: string;
};

export type WallElevationScene = {
  wall: Wall;
  title: string;
  width: number;
  height: number;
  items: ElevationItem[];
  salesEstimateOnly: true;
  notForProduction: true;
  dimensionConfidence: "ROUGH";
};

const WALL_TITLES: Record<Wall, string> = {
  TOP: "Back Wall",
  LEFT: "Left Wall",
  RIGHT: "Right Wall",
  BOTTOM: "Front Wall"
};

const WALL_ORDER: Wall[] = ["TOP", "LEFT", "RIGHT", "BOTTOM"];
const SCENE_WIDTH = 680;
const SCENE_HEIGHT = 230;
const WALL_PADDING_X = 28;
const FLOOR_Y = 202;
const BASE_Y = 136;
const BASE_H = 54;
const WALL_CABINET_Y = 42;
const WALL_CABINET_H = 58;
const TALL_Y = 48;
const TALL_H = 142;
const WINDOW_Y = 64;
const WINDOW_H = 64;
const DOOR_Y = 58;
const DOOR_H = 144;

const KIND_ORDER: Record<ElevationItemKind, number> = {
  opening: 0,
  corner: 1,
  baseCabinet: 2,
  wallCabinet: 3,
  appliance: 4
};

export const ELEVATION_FLOOR_Y = FLOOR_Y;

export function buildElevationScene(plan: FloorPlan): WallElevationScene[] {
  return WALL_ORDER.map((wall) => buildWallScene(plan, wall)).filter(
    (scene): scene is WallElevationScene => scene !== null
  );
}

function clipItemsAgainstObstacles(
  items: ElevationItem[],
  obstacles: ElevationItem[]
): ElevationItem[] {
  let currentItems = items;
  
  for (const obs of obstacles) {
    const nextItems: ElevationItem[] = [];
    for (const item of currentItems) {
      const itemStart = item.x;
      const itemEnd = item.x + item.w;
      const obsStart = obs.x;
      const obsEnd = obs.x + obs.w;
      
      if (obsStart <= itemStart && obsEnd >= itemEnd) {
        continue;
      } else if (obsStart > itemStart && obsEnd < itemEnd) {
        nextItems.push({ ...item, w: obsStart - itemStart });
        nextItems.push({ ...item, key: item.key + "-split-" + obs.key, x: obsEnd, w: itemEnd - obsEnd });
      } else if (obsStart <= itemStart && obsEnd > itemStart && obsEnd < itemEnd) {
        nextItems.push({ ...item, x: obsEnd, w: itemEnd - obsEnd });
      } else if (obsStart > itemStart && obsStart < itemEnd && obsEnd >= itemEnd) {
        nextItems.push({ ...item, w: obsStart - itemStart });
      } else {
        nextItems.push(item);
      }
    }
    currentItems = nextItems;
  }
  
  return currentItems.filter(b => b.w >= 6);
}

function buildWallScene(plan: FloorPlan, wall: Wall): WallElevationScene | null {
  const appliances = applianceItems(plan, wall);
  const windows = windowItems(plan, wall);
  const doors = doorItems(plan, wall);

  const allCorners = cornerItems(plan, wall);
  const baseCorners = allCorners.filter(c => c.y > 100);
  const wallCorners = allCorners.filter(c => c.y < 100);

  const baseObstacles = [
    ...appliances.filter(a => ["sink", "dishwasher", "range", "cooktop", "fridge", "oven"].includes(a.symbol)),
    ...doors
  ];
  const baseCabinets = clipItemsAgainstObstacles([...baseCabinetItems(plan, wall), ...baseCorners], baseObstacles);

  const paddedWindows = windows.map(w => ({
    ...w,
    x: w.x - 8,
    w: w.w + 16
  }));

  const wallObstacles = [
    ...appliances.filter(a => ["hood", "fridge", "oven"].includes(a.symbol)),
    ...paddedWindows,
    ...doors
  ];
  const wallCabinets = clipItemsAgainstObstacles([...wallCabinetItems(plan, wall), ...wallCorners], wallObstacles);

  const items: ElevationItem[] = [
    ...baseCabinets,
    ...wallCabinets,
    ...appliances,
    ...windows,
    ...doors
  ];

  if (items.length === 0) return null;

  return {
    wall,
    title: WALL_TITLES[wall],
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    items: items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.x - b.x || a.y - b.y || a.key.localeCompare(b.key)),
    salesEstimateOnly: true,
    notForProduction: true,
    dimensionConfidence: "ROUGH"
  };
}

function baseCabinetItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  return plan.baseCabinets
    .filter((cabinet) => cabinet.wall === wall)
    .map((cabinet, index) => ({
      key: `base-${wall}-${index}`,
      kind: "baseCabinet",
      symbol: "baseCabinet",
      label: "Base cabinet",
      wall,
      ...mapRectToBand(plan, wall, cabinet, BASE_Y, BASE_H),
      sourceCode: cabinet.code
    }));
}

function wallCabinetItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  return plan.wallCabinets
    .filter((cabinet) => cabinet.wall === wall)
    .map((cabinet, index) => ({
      key: `wall-${wall}-${index}`,
      kind: "wallCabinet",
      symbol: "wallCabinet",
      label: "Wall cabinet",
      wall,
      ...mapRectToBand(plan, wall, cabinet, WALL_CABINET_Y, WALL_CABINET_H),
      sourceCode: cabinet.code
    }));
}

function cornerItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  const corners = plan.wallCorners.filter((corner) => cornerTouchesWall(corner.type, wall));
  const items: ElevationItem[] = [];

  corners.forEach((corner, index) => {
    items.push({
      key: `corner-base-${wall}-${index}`,
      kind: "corner",
      symbol: "corner",
      label: "Base corner cabinet",
      wall,
      ...mapRectToBand(plan, wall, corner, BASE_Y, BASE_H)
    });
    items.push({
      key: `corner-wall-${wall}-${index}`,
      kind: "corner",
      symbol: "corner",
      label: "Wall corner cabinet",
      wall,
      ...mapRectToBand(plan, wall, corner, WALL_CABINET_Y, WALL_CABINET_H)
    });
  });

  return items;
}

function applianceItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  return plan.appliances
    .filter((appliance) => appliance.wall === wall)
    .map((appliance) => {
      const band = applianceBand(appliance);
      return {
        key: `appliance-${appliance.key}`,
        kind: "appliance",
        symbol: applianceSymbol(appliance),
        label: appliance.label,
        wall,
        ...mapRectToBand(plan, wall, appliance, band.y, band.h)
      };
    });
}

function windowItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  if (plan.window?.wall !== wall) return [];

  return [
    {
      key: `opening-window-${wall}`,
      kind: "opening",
      symbol: "window",
      label: "Window",
      wall,
      ...mapRectToBand(plan, wall, plan.window, WINDOW_Y, WINDOW_H)
    }
  ];
}

function doorItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  if (plan.door?.wall !== wall) return [];

  return [
    {
      key: `opening-door-${wall}`,
      kind: "opening",
      symbol: "door",
      label: "Door",
      wall,
      ...mapRectToBand(plan, wall, plan.door.breakRect, DOOR_Y, DOOR_H)
    }
  ];
}

function mapRectToBand(
  plan: FloorPlan,
  wall: Wall,
  rect: PlanRect,
  y: number,
  h: number
): Pick<ElevationItem, "x" | "y" | "w" | "h"> {
  const axis = wallAxis(plan, wall);
  let start = rect.x;
  if (wall === "LEFT") {
    start = axis.start + axis.length - (rect.y + rect.h);
  } else if (wall === "RIGHT") {
    start = rect.y;
  } else if (wall === "BOTTOM") {
    start = axis.start + axis.length - (rect.x + rect.w);
  }
  const length = wall === "LEFT" || wall === "RIGHT" ? rect.h : rect.w;
  const usable = SCENE_WIDTH - WALL_PADDING_X * 2;
  const exactX1 = WALL_PADDING_X + ((start - axis.start) / axis.length) * usable;
  const exactX2 = exactX1 + (length / axis.length) * usable;

  const x1 = round(clamp(exactX1, WALL_PADDING_X, SCENE_WIDTH - WALL_PADDING_X));
  const x2 = round(clamp(exactX2, WALL_PADDING_X, SCENE_WIDTH - WALL_PADDING_X));

  return {
    x: x1,
    y,
    w: Math.max(1, x2 - x1),
    h
  };
}

function wallAxis(plan: FloorPlan, wall: Wall): { start: number; length: number } {
  const thickness = plan.room.thickness;
  if (wall === "TOP" || wall === "BOTTOM") {
    return {
      start: plan.room.x + thickness,
      length: plan.room.w - thickness * 2
    };
  }
  return {
    start: plan.room.y + thickness,
    length: plan.room.h - thickness * 2
  };
}

function applianceBand(appliance: ApplianceShape): { y: number; h: number } {
  if (appliance.symbol === "fridge" || appliance.symbol === "oven") {
    return { y: TALL_Y, h: TALL_H };
  }
  if (appliance.symbol === "hood") {
    return { y: 64, h: 44 };
  }
  return { y: BASE_Y, h: BASE_H };
}

function applianceSymbol(appliance: ApplianceShape): ElevationSymbol {
  // Cooktop reuses the range top-down footprint (same symbol) but is a distinct
  // appliance: burners only, no oven. Keyed off `key` so the elevation can draw
  // it without an oven door and the JSON/prompt stay accurate.
  if (appliance.key === "cooktop") return "cooktop";
  if (appliance.symbol === "sink") return "sink";
  if (appliance.symbol === "range") return "range";
  if (appliance.symbol === "fridge") return "fridge";
  if (appliance.symbol === "dishwasher") return "dishwasher";
  if (appliance.symbol === "oven") return "oven";
  if (appliance.symbol === "hood") return "hood";
  return "baseCabinet";
}

function cornerTouchesWall(type: "TL" | "TR" | "BL" | "BR", wall: Wall): boolean {
  return (
    (type === "TL" && (wall === "TOP" || wall === "LEFT")) ||
    (type === "TR" && (wall === "TOP" || wall === "RIGHT")) ||
    (type === "BL" && (wall === "BOTTOM" || wall === "LEFT")) ||
    (type === "BR" && (wall === "BOTTOM" || wall === "RIGHT"))
  );
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
