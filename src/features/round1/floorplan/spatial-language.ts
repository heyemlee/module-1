import type { FloorPlan, PlanRect, Wall } from "./plan-geometry";

/**
 * Deterministic translation of a `FloorPlan` into natural-language spatial
 * constraints for the customer concept rendering prompt.
 *
 * The deterministic core still owns all geometry; this module only relays it in
 * words. It encodes a single fixed camera convention so the image model cannot
 * invent its own viewpoint:
 *
 *   - `TOP`    -> the back wall straight ahead (the camera looks at it)
 *   - `BOTTOM` -> the front wall behind the camera (not visible)
 *   - `LEFT`   -> the left wall (recedes on the left)
 *   - `RIGHT`  -> the right wall (recedes on the right)
 *
 * Verified against `cabinetWall` / `relationToWall` in `plan-geometry.ts`.
 */
export type CameraSurface = "back" | "left" | "right" | "front";

export const APPLIANCE_NOUNS: Record<string, string> = {
  sink: "a sink",
  range: "a freestanding range (burners with an oven below)",
  fridge: "a refrigerator",
  dishwasher: "a dishwasher",
  oven: "a wall oven",
  hood: "a range hood"
};

/**
 * Noun for an appliance, distinguishing a cooktop from a range. Both share the
 * top-down `range` symbol (identical footprint), but a cooktop has burners only
 * and NO oven, so it must read differently in the rendering prompt.
 */
export function applianceNoun(appliance: {
  key: string;
  symbol: string;
  label: string;
}): string {
  if (appliance.key === "ovenMicrowaveStack") {
    return "a stacked wall oven and microwave tower";
  }
  if (appliance.key === "microwaveOvenCombo") {
    return "a microwave / oven combo";
  }
  if (appliance.key === "cooktop") {
    return "a cooktop (burners only, no oven below)";
  }
  return APPLIANCE_NOUNS[appliance.symbol] ?? appliance.label;
}

const WALL_TO_CAMERA: Record<Wall, CameraSurface> = {
  TOP: "back",
  BOTTOM: "front",
  LEFT: "left",
  RIGHT: "right"
};

const SURFACE_SHORT: Record<CameraSurface, string> = {
  back: "the back wall",
  left: "the left wall",
  right: "the right wall",
  front: "the front wall"
};

const CORNER_LABELS: Record<string, string> = {
  TL: "back-left",
  TR: "back-right",
  BL: "front-left",
  BR: "front-right"
};

const CABINET_RUN_PHRASE = "a continuous run of base and wall cabinets";

export function wallToCamera(wall: Wall): CameraSurface {
  return WALL_TO_CAMERA[wall];
}

export function cameraSurfaceShort(surface: CameraSurface): string {
  return SURFACE_SHORT[surface];
}

/**
 * Ordering key for a shape on a wall, in camera reading order. Sorting ascending
 * by this value yields:
 *   - back/front walls: left -> right (by center x)
 *   - left/right walls: nearest the camera -> far end (largest y is nearest,
 *     because the camera stands at the front / large-y side)
 */
export function alongAxisValue(wall: Wall, rect: PlanRect): number {
  const horizontal = wall === "TOP" || wall === "BOTTOM";
  if (horizontal) {
    return rect.x + rect.w / 2;
  }
  return -(rect.y + rect.h / 2);
}

export type WallDescription = {
  surface: CameraSurface;
  /** Ordered appliance nouns (hood folded into the range item). */
  appliances: string[];
  hasCabinetRun: boolean;
};

/** Describes the appliances and cabinet run on a single wall, or null if empty. */
export function describeWall(plan: FloorPlan, wall: Wall): WallDescription | null {
  const onWall = plan.appliances
    .filter((appliance) => appliance.wall === wall && appliance.symbol !== "hood")
    .slice()
    .sort((a, b) => alongAxisValue(wall, a) - alongAxisValue(wall, b));

  const hasHood = plan.appliances.some(
    (appliance) => appliance.wall === wall && appliance.symbol === "hood"
  );

  const appliances = onWall.map((appliance) => {
    const noun = applianceNoun(appliance);
    if (appliance.symbol === "range" && hasHood) {
      return `${noun} with a hood above it`;
    }
    return noun;
  });

  const hasCabinetRun =
    plan.baseCabinets.some((cabinet) => cabinet.wall === wall) ||
    plan.wallCabinets.some((cabinet) => cabinet.wall === wall);

  if (appliances.length === 0 && !hasCabinetRun) return null;

  return { surface: wallToCamera(wall), appliances, hasCabinetRun };
}

function readingOrderPhrase(surface: CameraSurface): string {
  return surface === "left" || surface === "right"
    ? "from nearest the camera to the far end"
    : "from left to right";
}

/** Full per-wall walkthrough sentence in camera order, or null if the wall is empty. */
export function wallWalkthroughSentence(
  plan: FloorPlan,
  wall: Wall
): string | null {
  const desc = describeWall(plan, wall);
  if (!desc) return null;

  let contents: string;
  if (desc.appliances.length > 0) {
    contents = joinList(desc.appliances);
    if (desc.hasCabinetRun) {
      contents += `, set within ${CABINET_RUN_PHRASE}`;
    }
  } else {
    contents = CABINET_RUN_PHRASE;
  }

  return `On ${cameraSurfaceShort(desc.surface)}, ${readingOrderPhrase(
    desc.surface
  )}: ${contents}.`;
}

/** Phrases for each corner cabinet, mapped to camera-relative corners. */
export function describeCorners(plan: FloorPlan): string[] {
  if (plan.wallCorners.length > 0) {
    const labels = Array.from(
      new Set(plan.wallCorners.map((corner) => CORNER_LABELS[corner.type]))
    ).filter(Boolean);
    return labels.map((label) => `a corner cabinet in the ${label} corner`);
  }
  if (plan.corners.length > 0) {
    return ["a corner cabinet"];
  }
  return [];
}

/** Window phrasing relative to its wall and the sink, or null if no window. */
export function describeWindow(plan: FloorPlan): string | null {
  const window = plan.window;
  if (!window) return null;

  const surface = wallToCamera(window.wall);
  const sink = plan.appliances.find(
    (appliance) => appliance.symbol === "sink" && appliance.wall === window.wall
  );

  if (sink) {
    const horizontal = window.wall === "TOP" || window.wall === "BOTTOM";
    const windowCenter = horizontal
      ? window.x + window.w / 2
      : window.y + window.h / 2;
    const sinkCenter = horizontal ? sink.x + sink.w / 2 : sink.y + sink.h / 2;
    const tolerance = (horizontal ? sink.w : sink.h) * 0.6;
    if (Math.abs(windowCenter - sinkCenter) <= tolerance) {
      return `a window on ${cameraSurfaceShort(
        surface
      )} centered above the sink, letting in natural daylight`;
    }
  }

  return `a window on ${cameraSurfaceShort(
    surface
  )}, letting in natural daylight`;
}

/**
 * Door phrasing. Always emits a negative constraint to stop wall drift. An open
 * passage is rendered as a cased opening with no door leaf, so it is described
 * differently from a swinging door.
 */
export function describeDoor(plan: FloorPlan): string {
  const door = plan.door;
  if (!door) {
    return "There is no entry door in this view; do not add a door to any wall.";
  }
  const isPassage = door.kind === "OPEN_PASSAGE";
  const opening = isPassage
    ? "open passage (a cased wall opening with no door leaf)"
    : "entry door";
  const surface = wallToCamera(door.wall);
  if (surface === "front") {
    return `The ${opening} is on the front wall behind the camera and must NOT appear on the back, left, or right walls.`;
  }
  if (isPassage) {
    return `The ${opening} is on ${cameraSurfaceShort(
      surface
    )}; render it as an open doorway with no swinging door leaf, and do not draw a door or opening on any other wall.`;
  }
  return `The ${opening} is on ${cameraSurfaceShort(
    surface
  )}; do not draw a door on any other wall.`;
}

/**
 * Note for appliances that sit on the front wall (behind the camera) so the
 * model does not relocate them onto a visible wall — e.g. a galley fridge on
 * the front run, or any appliance the user dragged to the front wall. Returns
 * null when nothing sits on the front wall (as in the default L-shape, whose
 * appliances all stay within the L).
 */
export function describeBehindCameraAppliances(plan: FloorPlan): string | null {
  const front = plan.appliances.filter(
    (appliance) => appliance.wall === "BOTTOM" && appliance.symbol !== "hood"
  );
  if (front.length === 0) return null;

  const nouns = Array.from(new Set(front.map((appliance) => applianceNoun(appliance))));
  const isPlural = front.length > 1;
  return `Note: ${joinList(nouns)} ${isPlural ? "are" : "is"} on the front wall behind the viewpoint, so ${
    isPlural ? "they are" : "it is"
  } not visible in this view; do not place ${
    isPlural ? "them" : "it"
  } on a visible wall.`;
}

/** Oxford-comma list join. */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
