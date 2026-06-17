import { buildRound1RenderingPrompt } from "@/features/round1/rendering-prompt";
import type { Round1Snapshot } from "@/features/round1/snapshot";
import type {
  ImageGenerationSize,
  OpenAIImageAdapter
} from "@/infrastructure/image/openai-image-adapter";

// Landscape size that matches the top-down plan aspect ratio.
export const DEFAULT_RENDERING_SIZE: ImageGenerationSize = "1536x1024";

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
  adapter: OpenAIImageAdapter;
  size?: ImageGenerationSize;
}): Promise<Round1Rendering> {
  if (!input.referenceImagesBase64?.length) {
    throw new Error("At least one floor plan reference image is required for rendering");
  }

  const prompt = buildRound1RenderingPrompt(input.snapshot);
  const size = input.size ?? DEFAULT_RENDERING_SIZE;

  const result = await input.adapter.generateConceptRendering({
    prompt,
    size,
    referenceImagesBase64: input.referenceImagesBase64
  });

  return {
    model: result.model,
    imageBase64: result.imageBase64,
    prompt,
    size,
    basedOnSnapshotGeneratedAt: input.snapshot.generatedAt,
    salesEstimateOnly: true,
    notForProduction: true,
    dimensionConfidence: "ROUGH"
  };
}
