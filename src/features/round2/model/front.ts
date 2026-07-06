import { CABINET_STANDARDS } from "./cabinet-standards";
import type {
  FrontAccessory,
  WallSegment,
  WallSegmentFront
} from "./round2-model";
import type { Round2DesignIntent } from "./design-intent";

// Phase 9 — cabinet front configuration. Geometry stays in WallSegment
// widths; the front only describes how the face is split into doors and
// drawers. Defaults derive from the shared door rule plus the design intent,
// and `segment.front` stores nothing but the exceptions a designer made.

export type ResolvedFront = Required<WallSegmentFront>;

const THREE_DRAWER_STACK = [1, 1, 1];

/**
 * Segments that carry a cabinet face: cabinets plus the sink base. Plain
 * appliance reservations (DW/RNG/REF) expose the appliance itself.
 */
export function segmentHasFront(segment: WallSegment): boolean {
  if (segment.kind === "cabinet") return true;
  return segment.kind === "appliance" && segment.cabinetKind === "sink";
}

export function resolveSegmentFront(
  segment: WallSegment,
  intent?: Round2DesignIntent
): ResolvedFront | null {
  if (!segmentHasFront(segment)) return null;

  const defaults = defaultFront(segment, intent);
  const exceptions = segment.front ?? {};
  return {
    doorCount: exceptions.doorCount ?? defaults.doorCount,
    drawerStack: exceptions.drawerStack ?? defaults.drawerStack,
    hardware: exceptions.hardware ?? defaults.hardware,
    accessories: exceptions.accessories ?? defaults.accessories
  };
}

export function describeFront(front: ResolvedFront | null): string {
  if (!front) return "—";
  const parts: string[] = [];
  if (front.drawerStack.length > 0) {
    parts.push(`${front.drawerStack.length} drawers`);
  }
  if (front.doorCount > 0) {
    parts.push(front.doorCount === 1 ? "1 door" : "2 doors");
  }
  if (parts.length === 0) parts.push("open");
  for (const accessory of front.accessories) {
    parts.push(ACCESSORY_LABELS[accessory]);
  }
  return parts.join(" + ");
}

export const ACCESSORY_LABELS: Record<FrontAccessory, string> = {
  trashPullout: "trash pullout",
  spicePullout: "spice pullout",
  lazySusan: "lazy Susan"
};

function defaultFront(
  segment: WallSegment,
  intent?: Round2DesignIntent
): ResolvedFront {
  const hardware =
    intent?.answers["hardware.style"] === "fingerPull"
      ? ("fingerPull" as const)
      : ("handle" as const);
  const doorCount = doorCountForWidth(segment.widthSixteenths);

  if (segment.cabinetKind === "corner") {
    return {
      doorCount: 1,
      drawerStack: [],
      hardware,
      accessories: segment.label.startsWith("LS") ? ["lazySusan"] : []
    };
  }

  // Autofill tags the functional neighbors by label: DB = drawer base beside
  // the range, WB = trash pullout beside the sink.
  if (segment.label.startsWith("DB")) {
    return { doorCount: 0, drawerStack: THREE_DRAWER_STACK, hardware, accessories: [] };
  }
  if (segment.label.startsWith("WB")) {
    return { doorCount: 1, drawerStack: [], hardware, accessories: ["trashPullout"] };
  }

  if (
    segment.cabinetKind === "base" &&
    intent?.answers["fronts.balance"] === "drawerForward"
  ) {
    return { doorCount: 0, drawerStack: THREE_DRAWER_STACK, hardware, accessories: [] };
  }

  return { doorCount, drawerStack: [], hardware, accessories: [] };
}

function doorCountForWidth(widthSixteenths: number): 1 | 2 {
  return widthSixteenths >= CABINET_STANDARDS.base.doorRule.doubleDoorMinSixteenths
    ? 2
    : 1;
}
