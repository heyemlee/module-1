import { buildRound1RenderingPrompt } from "@/features/round1/rendering-prompt";
import type { Round1Snapshot } from "@/features/round1/snapshot";
import type { CabinetKind, CabinetStyle, Round1TierColorIds } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import {
  buildRenderingColorPlan,
  effectiveTierColorIds,
  latestColorUpdatedAt,
  renderingSwatchGroups,
  type RenderingSwatchGroup
} from "@/features/round1/rendering-preferences";
import type {
  ImageGenerationSize,
  OpenAIImageAdapter
} from "@/infrastructure/image/openai-image-adapter";
import {
  normalizeRenderingImageBase64,
  TARGET_RENDERING_SIZE
} from "./rendering-image-normalization";

// Landscape size that matches the top-down plan aspect ratio.
export const DEFAULT_RENDERING_SIZE: ImageGenerationSize = TARGET_RENDERING_SIZE;

export type Round1RenderingPreferenceStamp = {
  cabinetStyle: CabinetStyle;
  doorColorId: string;
  colorUpdatedAt: string | null;
  /**
   * Per-cabinet-type overrides actually used, `null` per type meaning "same as
   * the main door color". Lets the UI mark a rendering stale when only a
   * cabinet type was recolored. Absent on renderings generated before
   * per-cabinet-type colors existed.
   */
  tierColorIds?: Round1TierColorIds | null;
};

/**
 * Customer-facing Round 1 concept rendering.
 *
 * It is a NON-AUTHORITATIVE concept preview. It is derived from the frozen
 * snapshot but is never written back into it, never flips readiness or any
 * snapshot gating flag, and never becomes the source of truth for cabinet data,
 * dimensions, counts, geometry, or quote data. `basedOnSnapshotGeneratedAt`
 * lets the UI warn when the rendering is stale relative to a regenerated
 * snapshot.
 */
export type Round1Rendering = {
  model: string;
  imageBase64: string;
  prompt: string;
  size: ImageGenerationSize;
  basedOnSnapshotGeneratedAt: string;
  salesEstimateOnly: true;
  notForProduction: true;
  dimensionConfidence: "ROUGH";
  basedOnRenderingPreferences: Round1RenderingPreferenceStamp;
};

/**
 * Generates a concept rendering from BOTH the deterministic floor plan
 * reference image and a JSON-derived prompt built from the same authoritative
 * snapshot. The deterministic core still owns the prompt construction and all
 * the data it relays; the adapter only paints pixels.
 */
export async function generateRound1Rendering(input: {
  snapshot: Round1Snapshot;
  referenceImagesBase64: string[];
  renderingPreferences: {
    cabinetStyle: CabinetStyle;
    color: CabinetColor;
    /** Optional per-cabinet-type door colors; unset types follow `color`. */
    tierColors?: Partial<Record<CabinetKind, CabinetColor | null>>;
    /**
     * Material swatches actually attached, in the order they appear after the
     * top-down plan in `referenceImagesBase64`. Omit to let the color plan
     * decide, which is only correct when the caller attached every swatch the
     * plan implies.
     */
    swatchGroups?: RenderingSwatchGroup[];
  };
  adapter: OpenAIImageAdapter;
  size?: ImageGenerationSize;
}): Promise<Round1Rendering> {
  if (!input.referenceImagesBase64?.length) {
    throw new Error("At least one floor plan reference image is required for rendering");
  }

  const colorPlan = buildRenderingColorPlan({
    primary: input.renderingPreferences.color,
    tierColors: input.renderingPreferences.tierColors
  });
  const prompt = buildRound1RenderingPrompt(input.snapshot, {
    cabinetStyle: input.renderingPreferences.cabinetStyle,
    color: input.renderingPreferences.color,
    tierColors: input.renderingPreferences.tierColors,
    swatchGroups:
      input.renderingPreferences.swatchGroups ?? renderingSwatchGroups(colorPlan)
  });
  const size = input.size ?? DEFAULT_RENDERING_SIZE;

  const result = await input.adapter.generateConceptRendering({
    prompt,
    size,
    referenceImagesBase64: input.referenceImagesBase64
  });
  const imageBase64 = await normalizeRenderingImageBase64(result.imageBase64);

  return {
    model: result.model,
    imageBase64,
    prompt,
    size,
    basedOnSnapshotGeneratedAt: input.snapshot.generatedAt,
    basedOnRenderingPreferences: {
      cabinetStyle: input.renderingPreferences.cabinetStyle,
      doorColorId: input.renderingPreferences.color.id,
      // Newest edit across every color in use, so re-uploading any swatch marks
      // the rendering stale — not just an edit to the main color.
      colorUpdatedAt: latestColorUpdatedAt(colorPlan),
      tierColorIds: effectiveTierColorIds(colorPlan)
    },
    salesEstimateOnly: true,
    notForProduction: true,
    dimensionConfidence: "ROUGH"
  };
}
