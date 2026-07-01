import type { Round1Snapshot } from "./snapshot";
import type { Wall } from "./floorplan/plan-geometry";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import {
  applianceNoun,
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
 * This is intentionally different from a bare layout-shell prompt (which would
 * ask for an EMPTY architectural shell). Here we want a realistic, furnished
 * concept preview, so the prompt describes the kitchen's semantics and materials.
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
  LEFT_L_SHAPE: "left L-shaped kitchen",
  RIGHT_L_SHAPE: "right L-shaped kitchen",
  L_SHAPE: "L-shaped kitchen",
  U_SHAPE: "U-shaped kitchen",
  GALLEY: "galley kitchen with two parallel runs",
  PENINSULA: "kitchen with a continuous peninsula extending from the left wall",
  ISLAND: "kitchen with a central island",
    L_SHAPE_ISLAND: "L-shaped kitchen with a central island",
      U_SHAPE_ISLAND: "U-shaped kitchen with a central island",
        NO_PREFERENCE: "kitchen"
};

const OVEN_MICROWAVE_PHRASES: Record<string, string> = {
  RANGE_INCLUDES_OVEN: "the oven is built into the lower half of the freestanding range (the oven door must be clearly visible under the cooktop; DO NOT draw a separate wall oven)",
  WALL_OVEN_MICROWAVE_STACK: "a stacked wall oven and microwave tower in one tall appliance cabinet",
  SEPARATE_WALL_OVEN_AND_MICROWAVE: "a wall oven and a separate microwave location",
  MICROWAVE_DRAWER: "a microwave drawer",
  UPPER_CABINET_MICROWAVE: "a microwave in an upper cabinet",
  COUNTERTOP_MICROWAVE: "a countertop microwave",
  NO_MICROWAVE: "DO NOT draw a microwave",
  NO_OVEN: "DO NOT draw a separate wall oven",
  UNKNOWN: ""
};

const CAMERA_POLICIES: Record<string, string> = {
  ONE_WALL:
    "Use a centered front view, pulled back until the complete run and both ends are visible.",
  LEFT_L_SHAPE:
    "Use a three-quarter view from the open front-right side, aimed toward the inside corner so the complete back and left runs are visible.",
  L_SHAPE:
    "Use a three-quarter view from the open front-right side, aimed toward the inside corner so the complete back and left runs are visible.",
  RIGHT_L_SHAPE:
    "Use a three-quarter view from the open front-left side, aimed toward the inside corner so the complete back and right runs are visible. Do not mirror the layout.",
  U_SHAPE:
    "Place the camera centered outside the open end and slightly elevated so all three cabinet runs are visible from the back corners to both open ends.",
  GALLEY:
    "Place the camera at an open end of the galley aisle, slightly elevated and angled down the aisle so both opposing parallel cabinet runs on the left and right walls are completely visible together. Use a one-point perspective looking straight down the aisle.",
  PENINSULA:
    "Use a pulled-back three-quarter view from the open front-right side opposite the left-wall peninsula anchor, showing the complete back and left wall runs, the peninsula attachment point on the left wall, and its free end. CRITICAL REQUIREMENTS: The peninsula MUST be physically connected to the left wall cabinetry without any gaps or walkways between them. It is a continuous extension of the left wall cabinets, NOT a freestanding island. They share a single continuous countertop forming a seamless 90-degree inside corner on the left. The peninsula is anchored at the very front (nearest the camera) of the left wall run; any appliances on the left wall (such as a refrigerator) MUST be placed behind the peninsula anchor, towards the back wall. Cabinet fronts face the work zone. There must be no full-height blank island panel in place of the peninsula cabinet run. The physical attachment point on the left wall and free end remain visible.",
  ISLAND:
    "Use a pulled-back three-quarter view that keeps the complete perimeter run and full island inside the frame.",
  L_SHAPE_ISLAND:
    "Use a pulled-back three-quarter view from the open front-right side that keeps the complete back and left runs and full island inside the frame.",
  U_SHAPE_ISLAND:
    "Place the camera centered outside the open end and slightly elevated so all three cabinet runs and the full island remain inside the frame.",
  NO_PREFERENCE:
    "Use a pulled-back three-quarter view that keeps the complete kitchen layout inside the frame."
};

function visibleWallsForLayout(layout: string): Wall[] {
  return layout === "GALLEY"
    ? ["TOP", "BOTTOM"]
    : ["TOP", "LEFT", "RIGHT"];
}

export type RenderingPromptPreferences = {
  cabinetStyle: CabinetStyle;
  color: CabinetColor;
};

export function buildRound1RenderingPrompt(
  snapshot: Round1Snapshot,
  preferences: RenderingPromptPreferences
): string {
  const { normalized, floorPlan, preliminaryCabinets, showroomForm } = snapshot;

  const layoutPhrase =
    LAYOUT_PHRASES[normalized.layoutPreference] ?? "kitchen";
  const layoutCamera =
    CAMERA_POLICIES[normalized.layoutPreference] ??
    CAMERA_POLICIES.NO_PREFERENCE;
  const frontWallVisible = normalized.layoutPreference === "GALLEY";

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
  const style = describeCabinetStyle(preferences.cabinetStyle);
  const colorDescription = preferences.color.promptDescription;

  const lines: string[] = [
    "Create a warm, spacious, and photorealistic customer concept rendering of a high-end residential kitchen for a Round 1 sales preview in a luxury California Bay Area single-family house. Ensure the room features high ceilings and an airy, open-concept feel to maximize the perceived size of the space.",
    "",
    `Design style: ${style.designStyle}, ${colorDescription}, calm contemporary California residential styling, bright natural daylight, and restrained neutral surfaces that complement the selected cabinet door color.`,
    "",
    "Appliances: use American residential appliances and proportions appropriate for a Bay Area single-family home (e.g., large stainless or panel-ready models). Do not use compact European appliance proportions. CRITICAL: ONLY draw the exact appliances explicitly listed in this prompt. DO NOT hallucinate or add any extra appliances (like wall ovens or microwaves) that are not explicitly requested.",
    "",
    `Camera and viewpoint: use a moderately wide architectural perspective with corrected verticals. ${layoutCamera} Keep every required cabinet run fully inside the frame with visible breathing room at every outer end; no cabinet, appliance, countertop, island, or peninsula may touch or be cropped by the image edge. Do not use a fisheye lens or exaggerated ultra-wide distortion.`,
    "",
    "Use the provided reference images as the authoritative spatial references.",
    "- Reference 1 controls the camera and 3D massing.",
    "- Reference 2 controls top-down positions.",
    "- Reference 3 controls vertical stacking only and must not override floor-plan geometry.",
    "- Reference 4, when present, controls material only.",
    "Keep every wall, appliance, sink, window, corner cabinet, and cabinet run exactly where the references place them. Do not rearrange, mirror, or move anything to a different wall.",
    "CRITICAL REQUIREMENT: Do not cluster or group appliances together (e.g., sink and dishwasher) unless they are physically adjacent in the layout reference. Strictly follow the reference for the empty counter space and gaps between appliances.",
    "",
    `Kitchen shape: ${layoutPhrase}.`,
    `Approximate room size: ${roomDimensions}.`
  ];

  // When a swatch image is available it is sent to the image model as an extra
  // MATERIAL reference, so tell the model to match the cabinet door finish to it.
  if (preferences.color.swatchImageUrl) {
    lines.push(
      "",
      "A separate close-up image of the selected cabinet door color/material swatch is also provided as a reference. Match the cabinet door fronts' exact color, tone, sheen, and any wood-grain pattern to that swatch. The swatch is a material reference only — do not render it as a physical object in the room."
    );
  }

  // Explicit per-wall walkthrough, derived from the deterministic geometry.
  for (const wall of visibleWallsForLayout(normalized.layoutPreference)) {
    const sentence = wallWalkthroughSentence(floorPlan, wall, normalized.layoutPreference);
    if (sentence) lines.push(sentence);
  }

  const corners = describeCorners(floorPlan);
  if (corners.length > 0) {
    lines.push(
      `Corner cabinetry: ${joinList(corners)}. Do not omit the corner cabinet${corners.length === 1 ? "" : "s"
      }.`
    );
  }

  if (floorPlan.island) {
    lines.push(
      "Include the central island shown in the reference image; it sits on the floor between the camera and the back wall."
    );
  }

  if (floorPlan.peninsula) {
    lines.push(
      "Include the continuous peninsula cabinet run shown in the reference image; it is physically connected to the left wall cabinetry without any gaps or walkways, extending horizontally into the room and sharing a single continuous countertop."
    );
  }

  const islandAppliances = floorPlan.appliances.filter((a) => a.onIsland);
  if (islandAppliances.length > 0) {
    lines.push(`On the island: ${joinList(islandAppliances.map(applianceNoun))}.`);
  }

  const peninsulaAppliances = floorPlan.appliances.filter((a) => a.onPeninsula);
  if (peninsulaAppliances.length > 0) {
    lines.push(`On the peninsula: ${joinList(peninsulaAppliances.map(applianceNoun))}.`);
  }

  const windowPhrase = describeWindow(floorPlan, normalized.layoutPreference);
  if (windowPhrase) {
    if (windowPhrase.startsWith("CRITICAL") || windowPhrase.startsWith("There")) {
      lines.push(windowPhrase);
    } else {
      lines.push(`Include ${windowPhrase}.`);
    }
  }

  lines.push(describeDoor(floorPlan, { frontWallVisible, layout: normalized.layoutPreference }));

  const behindCamera = describeBehindCameraAppliances(floorPlan, {
    frontWallVisible
  });
  if (behindCamera) {
    lines.push(behindCamera);
  }

  const ovenMicrowaveConfiguration =
    showroomForm.layoutSensitiveCabinets?.ovenMicrowave?.configuration ??
    "UNKNOWN";
  const ovenPhrase =
    OVEN_MICROWAVE_PHRASES[ovenMicrowaveConfiguration];
  const microwavePlacement = describeMicrowavePlacement(
    snapshot,
    ovenMicrowaveConfiguration
  );
  if (ovenPhrase) {
    lines.push(`Oven / microwave: ${ovenPhrase}.`);
  }
  if (microwavePlacement) {
    lines.push(microwavePlacement);
  }

  const cookingPhrase = describeRoughCookingAppliances(
    showroomForm.layoutSensitiveCabinets?.cookingAppliances,
    ovenMicrowaveConfiguration,
    Boolean(microwavePlacement),
    normalized.layoutPreference
  );
  if (cookingPhrase) {
    lines.push(`Cooking appliances: ${cookingPhrase}.`);
  }

  const fuel = showroomForm.fixtures.range.fuel.trim();
  if (fuel && fuel.toUpperCase() !== "UNKNOWN") {
    lines.push(`The range is ${fuel.toLowerCase()}.`);
  }

  lines.push(
    `Cabinetry: approximately ${baseCount} base cabinet${baseCount === 1 ? "" : "s"
    } and ${wallCount} wall cabinet${wallCount === 1 ? "" : "s"
    }, using ${style.cabinetry} with ${colorDescription}.`,
    "",
    "This is a sales-estimate concept image only, not a production drawing. All dimensions are approximate and subject to confirmation.",
    "Do not draw dimension lines, measurements, cabinet codes, labels, numbers, legends, or any text annotations on the image.",
    "Render it as an inviting, realistic interior preview."
  );

  return lines.join("\n");
}

function describeCabinetStyle(cabinetStyle: CabinetStyle) {
  if (cabinetStyle === "AMERICAN_FRAMED") {
    return {
      designStyle:
        "American framed cabinetry (classic face-frame construction, framed doors or shaker-style proportions, refined rails and stiles, modest traditional detailing, and furniture-like residential millwork)",
      cabinetry:
        "American framed cabinetry with visible face-frame proportions, framed door detailing, and polished residential hardware or integrated pulls appropriate to the selected door style"
    };
  }

  return {
    designStyle:
      "modern frameless European-style cabinetry (flat slab doors, full-height single panel doors with no splits, handleless press-to-open design, clean reveals, continuous toe kicks, NO crown molding, NO top fascia board, NO soffit, NO top trim)",
    cabinetry:
      "modern frameless European-style cabinetry with flat fronts, true handleless press-to-open design (no visible hardware), and continuous recessed toe kicks"
  };
}

function describeRoughCookingAppliances(
  cooking:
    | {
      range?: { status?: string; relation?: string };
      cooktop?: { status?: string; relation?: string };
      wallOven?: { status?: string; relation?: string };
      microwaveOvenCombo?: { status?: string; relation?: string };
    }
    | undefined,
  ovenMicrowaveConfiguration: string,
  hasSpecificMicrowavePlacement = false,
  layoutPreference?: string
) {
  if (!cooking) return "";
  const suppressExplicitOvenMicrowave =
    ovenMicrowaveConfiguration === "WALL_OVEN_MICROWAVE_STACK" ||
    ovenMicrowaveConfiguration === "SEPARATE_WALL_OVEN_AND_MICROWAVE";
  const items = [
    describeRoughAppliance("freestanding range (with visible oven door underneath)", cooking.range, layoutPreference),
    describeRoughAppliance("built-in cooktop (burners only, no oven — DO NOT draw an oven door under it)", cooking.cooktop, layoutPreference),
    suppressExplicitOvenMicrowave
      ? ""
      : describeRoughAppliance("wall oven", cooking.wallOven, layoutPreference),
    suppressExplicitOvenMicrowave || hasSpecificMicrowavePlacement
      ? ""
      : describeRoughAppliance(
        "microwave",
        cooking.microwaveOvenCombo,
        layoutPreference
      )
  ].filter(Boolean);
  return items.join("; ");
}

function describeMicrowavePlacement(
  snapshot: Round1Snapshot,
  configuration: string
): string {
  const microwave = snapshot.floorPlan.appliances.find(
    (appliance) => appliance.key === "microwaveOvenCombo"
  );
  const counterSurface = microwave?.onPeninsula
    ? "peninsula"
    : microwave?.onIsland
      ? "island"
      : null;

  if (counterSurface) {
    return `Microwave placement: install the standalone built-in microwave under-counter in the ${counterSurface} base cabinet. Do not add a tall cabinet, wall-oven tower, or upper cabinet at this location.`;
  }

  switch (configuration) {
    case "WALL_OVEN_MICROWAVE_STACK":
      return "Microwave placement: place the microwave above the wall oven in one tall appliance cabinet.";
    case "MICROWAVE_DRAWER":
      return "Microwave placement: install a microwave drawer under-counter in a base cabinet; do not turn it into a tall or upper cabinet.";
    case "UPPER_CABINET_MICROWAVE":
      return "Microwave placement: use a built-in microwave integrated into an upper wall cabinet.";
    case "COUNTERTOP_MICROWAVE":
      return "Microwave placement: use a freestanding countertop microwave; do not enclose it as a built-in appliance.";
    default:
      return "";
  }
}

function describeRoughAppliance(
  label: string,
  value: { status?: string; relation?: string } | undefined,
  layoutPreference?: string
) {
  if (!value || value.status !== "YES") return "";
  return `${label} on ${relationPhrase(value.relation, layoutPreference)}`;
}

function relationPhrase(relation: string | undefined, layoutPreference?: string) {
  const isGalley = layoutPreference === "GALLEY";
  const phrases: Record<string, string> = {
    BACK_SIDE: isGalley ? "the left wall" : "the back wall",
    FRONT_SIDE: isGalley ? "the right wall" : "the front wall",
    LEFT_SIDE: isGalley ? "the front wall" : "the left wall",
    RIGHT_SIDE: isGalley ? "the back wall" : "the right wall",
    ON_ISLAND: "the island",
    ON_PENINSULA: "the attached peninsula",
    UNKNOWN: "its explicitly designated location"
  };
  return phrases[relation ?? "UNKNOWN"] ?? "its explicitly designated location";
}
