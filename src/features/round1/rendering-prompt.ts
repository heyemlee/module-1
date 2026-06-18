import type { Round1Snapshot } from "./snapshot";
import type { Wall } from "./floorplan/plan-geometry";
import {
  describeBehindCameraAppliances,
  describeCorners,
  describeDoor,
  describeWindow,
  joinList,
  wallWalkthroughSentence
} from "./floorplan/spatial-language";

/**
 * Builds the JSON-derived prompt for the customer concept rendering.
 *
 * This is intentionally different from `buildRound1LayoutPrompt` (which asks for
 * an EMPTY architectural shell). Here we want a realistic, furnished concept
 * preview, so the prompt describes the kitchen's semantics and materials.
 *
 * Unlike the earlier version, spatial placement is no longer deferred entirely
 * to the reference image. The prompt now translates the deterministic
 * `floorPlan` into explicit, camera-anchored spatial constraints (which wall
 * each appliance is on, the corner cabinet, the window, and the door), so the
 * image model cannot rearrange the layout or invent its own viewpoint.
 *
 * The prompt is derived entirely from the frozen, authoritative snapshot. It
 * never invents counts, dimensions, or geometry; it only relays what the
 * deterministic core already decided, and it explicitly marks the output as a
 * sales-estimate concept with no on-image dimensions or labels.
 */
const LAYOUT_PHRASES: Record<string, string> = {
  ONE_WALL: "single-wall (one-wall) kitchen",
  L_SHAPE: "L-shaped kitchen",
  U_SHAPE: "U-shaped kitchen",
  GALLEY: "galley kitchen with two parallel runs",
  PENINSULA: "kitchen with a peninsula",
  ISLAND: "kitchen with a central island",
  L_SHAPE_ISLAND: "L-shaped kitchen with a central island",
  U_SHAPE_ISLAND: "U-shaped kitchen with a central island",
  NO_PREFERENCE: "kitchen"
};

const OVEN_MICROWAVE_PHRASES: Record<string, string> = {
  RANGE_INCLUDES_OVEN: "the oven is built into the range",
  WALL_OVEN_MICROWAVE_STACK: "a stacked wall-oven and microwave tower",
  MICROWAVE_DRAWER: "a microwave drawer",
  UPPER_CABINET_MICROWAVE: "a microwave in an upper cabinet",
  COUNTERTOP_MICROWAVE: "a countertop microwave",
  NO_MICROWAVE: "no microwave",
  NO_OVEN: "no separate wall oven",
  UNKNOWN: ""
};

// Walls visible from the fixed camera, in reading order. The front wall
// (BOTTOM) is behind the camera and described separately.
const VISIBLE_WALLS: Wall[] = ["TOP", "LEFT", "RIGHT"];

export function buildRound1RenderingPrompt(snapshot: Round1Snapshot): string {
  const { normalized, floorPlan, preliminaryCabinets, showroomForm } = snapshot;

  const layoutPhrase =
    LAYOUT_PHRASES[normalized.layoutPreference] ?? "kitchen";

  const length = normalized.room.length.value;
  const width = normalized.room.width.value;
  const roomDimensions =
    length && width
      ? `roughly ${length}" by ${width}"`
      : "approximate (rough) dimensions";

  const baseCount = preliminaryCabinets.cabinets.filter(
    (cabinet) => cabinet.kind === "BASE"
  ).length;
  const wallCount = preliminaryCabinets.cabinets.filter(
    (cabinet) => cabinet.kind === "WALL"
  ).length;

  const lines: string[] = [
    "Create a warm, photorealistic customer concept rendering of a residential kitchen for a Round 1 sales preview in a California Bay Area single-family house.",
    "",
    "Design style: modern frameless European-style cabinetry (flat slab doors, clean reveals, minimal or integrated pulls), medium-tone wood grain cabinet fronts, calm contemporary California residential styling, bright natural daylight, and restrained neutral surfaces that complement the wood.",
    "",
    "Appliances: use American residential appliances and proportions appropriate for a Bay Area single-family home, such as a stainless or panel-ready American-size refrigerator, range/cooktop, hood, dishwasher, oven, and microwave where shown. Do not use compact European appliance proportions unless the reference layout explicitly requires them.",
    "",
    "Camera and viewpoint: render in one-point perspective as if standing at the front of the room looking straight at the back wall. The back wall is straight ahead; the left wall recedes on the left; the right wall recedes on the right; the front wall is behind the camera and is not shown. Do not change this viewpoint.",
    "",
    "Use the provided reference image as the authoritative spatial reference. Keep every wall, appliance, sink, window, corner cabinet, and cabinet run exactly where the reference places them. Do not rearrange, mirror, or move anything to a different wall.",
    "",
    `Kitchen shape: ${layoutPhrase}.`,
    `Approximate room size: ${roomDimensions}.`
  ];

  // Explicit per-wall walkthrough, derived from the deterministic geometry.
  for (const wall of VISIBLE_WALLS) {
    const sentence = wallWalkthroughSentence(floorPlan, wall);
    if (sentence) lines.push(sentence);
  }

  const corners = describeCorners(floorPlan);
  if (corners.length > 0) {
    lines.push(
      `Corner cabinetry: ${joinList(corners)}. Do not omit the corner cabinet${
        corners.length === 1 ? "" : "s"
      }.`
    );
  }

  if (floorPlan.island) {
    lines.push(
      "Include the central island shown in the reference image; it sits on the floor between the camera and the back wall."
    );
  }

  const windowPhrase = describeWindow(floorPlan);
  if (windowPhrase) {
    lines.push(`Include ${windowPhrase}.`);
  }

  lines.push(describeDoor(floorPlan));

  const behindCamera = describeBehindCameraAppliances(floorPlan);
  if (behindCamera) {
    lines.push(behindCamera);
  }

  const ovenPhrase =
    OVEN_MICROWAVE_PHRASES[
      showroomForm.layoutSensitiveCabinets?.ovenMicrowave?.configuration || "UNKNOWN"
    ];
  if (ovenPhrase) {
    lines.push(`Oven / microwave: ${ovenPhrase}.`);
  }

  const cookingPhrase = describeRoughCookingAppliances(
    showroomForm.layoutSensitiveCabinets?.cookingAppliances
  );
  if (cookingPhrase) {
    lines.push(`Cooking appliances: ${cookingPhrase}.`);
  }

  const fuel = showroomForm.fixtures.range.fuel.trim();
  if (fuel && fuel.toUpperCase() !== "UNKNOWN") {
    lines.push(`The range is ${fuel.toLowerCase()}.`);
  }

  lines.push(
    `Cabinetry: approximately ${baseCount} base cabinet${
      baseCount === 1 ? "" : "s"
    } and ${wallCount} wall cabinet${
      wallCount === 1 ? "" : "s"
    }, using modern frameless European-style cabinetry with flat medium-tone wood grain fronts and simple integrated or low-profile hardware.`,
    "",
    "This is a sales-estimate concept image only, not a production drawing. All dimensions are approximate and subject to confirmation.",
    "Do not draw dimension lines, measurements, cabinet codes, labels, numbers, legends, or any text annotations on the image.",
    "Render it as an inviting, realistic interior preview."
  );

  return lines.join("\n");
}

function describeRoughCookingAppliances(
  cooking:
    | {
        range?: { status?: string; relation?: string };
        cooktop?: { status?: string; relation?: string };
        wallOven?: { status?: string; relation?: string };
        microwaveOvenCombo?: { status?: string; relation?: string };
      }
    | undefined
) {
  if (!cooking) return "";
  const items = [
    describeRoughAppliance("range", cooking.range),
    describeRoughAppliance("cooktop", cooking.cooktop),
    describeRoughAppliance("wall oven", cooking.wallOven),
    describeRoughAppliance(
      "microwave / oven combo",
      cooking.microwaveOvenCombo
    )
  ].filter(Boolean);
  return items.join("; ");
}

function describeRoughAppliance(
  label: string,
  value: { status?: string; relation?: string } | undefined
) {
  if (!value || value.status !== "YES") return "";
  return `${label} on ${relationPhrase(value.relation)}`;
}

function relationPhrase(relation: string | undefined) {
  const phrases: Record<string, string> = {
    BACK_SIDE: "the back wall",
    FRONT_SIDE: "the front wall",
    LEFT_SIDE: "the left wall",
    RIGHT_SIDE: "the right wall",
    ON_ISLAND: "the island",
    UNKNOWN: "an unconfirmed wall"
  };
  return phrases[relation ?? "UNKNOWN"] ?? "an unconfirmed wall";
}
