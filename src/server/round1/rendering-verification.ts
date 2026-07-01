import type { Round1Snapshot } from "@/features/round1/snapshot";
import {
  applianceNoun,
  cameraSurfaceShort,
  wallToCamera
} from "@/features/round1/floorplan/spatial-language";

/**
 * Closed-loop check for the concept rendering.
 *
 * The FloorPlan is authoritative, so we can turn it into a compact "expected
 * contents" checklist and ask a vision model whether the rendered image matches.
 * This closes the loop the open-ended image generation leaves open: extra
 * hallucinated appliances, a peninsula rendered as a freestanding island, or a
 * sink on the wrong wall get caught instead of silently shipped.
 *
 * `buildExpectedInventory` / `formatInventoryForPrompt` are pure and testable;
 * the model call is behind the injected `VisionClient` so it can be faked.
 */

export type ExpectedInventory = {
  /** Appliances grouped by camera-relative surface (back/left/right wall, island, peninsula). */
  appliancesByWall: { wall: string; items: string[] }[];
  window: string | null;
  door: string | null;
  hasIsland: boolean;
  hasPeninsula: boolean;
};

export function buildExpectedInventory(snapshot: Round1Snapshot): ExpectedInventory {
  const plan = snapshot.floorPlan;
  const layout = snapshot.normalized.layoutPreference;

  const byWall = new Map<string, string[]>();
  for (const appliance of plan.appliances) {
    const surface = appliance.onIsland
      ? "the island"
      : appliance.onPeninsula
        ? "the peninsula"
        : cameraSurfaceShort(wallToCamera(appliance.wall, layout));
    const list = byWall.get(surface) ?? [];
    list.push(applianceNoun(appliance));
    byWall.set(surface, list);
  }

  return {
    appliancesByWall: [...byWall.entries()].map(([wall, items]) => ({ wall, items })),
    window: plan.window ? cameraSurfaceShort(wallToCamera(plan.window.wall, layout)) : null,
    door: plan.door ? cameraSurfaceShort(wallToCamera(plan.door.wall, layout)) : null,
    hasIsland: Boolean(plan.island),
    hasPeninsula: Boolean(plan.peninsula)
  };
}

export function formatInventoryForPrompt(inventory: ExpectedInventory): string {
  const lines: string[] = [];
  for (const group of inventory.appliancesByWall) {
    if (group.items.length) lines.push(`- ${group.wall}: ${group.items.join(", ")}`);
  }
  lines.push(`- window: ${inventory.window ?? "none"}`);
  lines.push(`- door or open passage: ${inventory.door ?? "none"}`);
  if (inventory.hasIsland) lines.push("- a central island is present");
  if (inventory.hasPeninsula)
    lines.push("- a peninsula physically attached to a wall (not a freestanding island) is present");
  return lines.join("\n");
}

export type VerificationResult = {
  ok: boolean;
  discrepancies: string[];
  raw: string;
};

/** Injected so verification is testable without a live vision API. */
export type VisionClient = {
  analyze(input: { prompt: string; imageBase64: string }): Promise<string>;
};

export function buildVerificationPrompt(inventory: ExpectedInventory): string {
  return [
    "You are auditing a kitchen concept rendering against its required contents.",
    "The rendering must contain EXACTLY the following, on the stated camera-relative surfaces, and nothing extra:",
    formatInventoryForPrompt(inventory),
    "",
    "Report every mismatch — a missing item, an extra/hallucinated item, an item on the wrong surface, or a peninsula drawn as a freestanding island. Put each mismatch on its own line as a short phrase (e.g. \"extra microwave on the back wall\", \"sink missing\", \"peninsula rendered as a freestanding island\").",
    "If the rendering matches exactly, reply with only: OK"
  ].join("\n");
}

export async function verifyConceptRendering(input: {
  imageBase64: string;
  snapshot: Round1Snapshot;
  client: VisionClient;
}): Promise<VerificationResult> {
  const inventory = buildExpectedInventory(input.snapshot);
  const prompt = buildVerificationPrompt(inventory);
  const raw = (await input.client.analyze({ prompt, imageBase64: input.imageBase64 })).trim();
  const ok = /^ok[.!]?$/i.test(raw);
  const discrepancies = ok
    ? []
    : raw
        .split("\n")
        .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
        .filter(Boolean);
  return { ok, discrepancies, raw };
}
