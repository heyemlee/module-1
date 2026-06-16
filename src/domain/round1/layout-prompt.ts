import type { Round1Normalized } from "./schemas";

type OpeningStatus = Round1Normalized["openings"]["doors"]["status"];

/**
 * Builds the image prompt for the Round 1 layout background.
 *
 * The image model should only draw the empty architectural shell (walls in the
 * chosen layout shape, floor, doors, windows, and major obstacles). Appliances,
 * cabinets, MEP markers, labels, and the sales-estimate stamp are rendered by
 * the deterministic overlay, so the prompt explicitly forbids the model from
 * drawing them — this avoids duplicated appliances and text clutter on top of
 * the overlay, and keeps the AI out of source-of-truth data.
 */
export function buildRound1LayoutPrompt(normalized: Round1Normalized): string {
  const roomDimensions =
    normalized.room.length.value && normalized.room.width.value
      ? `${normalized.room.length.value}" by ${normalized.room.width.value}"`
      : "unknown rough dimensions";

  const lines: string[] = [
    "Create a clean, empty top-down kitchen floor plan shell for Round 1 customer confirmation.",
    "This is sales-estimate-only, not production data.",
    "",
    `Kitchen shape: ${normalized.layoutPreference}.`,
    `Rough room dimensions: ${roomDimensions}, confidence rough.`,
    `Draw only the architectural shell: perimeter walls arranged in the ${normalized.layoutPreference} configuration, the floor, door openings, and windows.`
  ];

  const doorHint = openingHint("door", normalized.openings.doors.status);
  if (doorHint) {
    lines.push(doorHint);
  }
  const windowHint = openingHint("window", normalized.openings.windows.status);
  if (windowHint) {
    lines.push(windowHint);
  }
  if (normalized.room.obstacles.length > 0) {
    lines.push(
      "Show the major structural obstacles (such as columns or beams) as simple blocks."
    );
  }

  lines.push(
    "",
    "Do not draw any appliances: no sink, range, cooktop, refrigerator, dishwasher, range hood, oven, or microwave.",
    "Do not draw any cabinets, countertops, islands, or furniture.",
    "Do not draw any water, gas, electric, or vent symbols.",
    "Do not add any text, labels, dimensions, annotations, legends, title block, north arrow, or key plan.",
    "Use a simple architectural plan style with a light background and a clean, empty interior.",
    "Leave the interior empty so the app can overlay base cabinets, wall cabinets, corner cabinet, appliances, MEP markers, labels, and confirmation markers."
  );

  return lines.join("\n");
}

function openingHint(kind: "door" | "window", status: OpeningStatus): string {
  if (status === "NO") {
    return `Do not draw any ${kind}.`;
  }
  if (status === "UNKNOWN") {
    return `Include one ${kind} opening; its exact position is to be confirmed.`;
  }
  return `Include ${kind} openings where appropriate on the exterior walls.`;
}
