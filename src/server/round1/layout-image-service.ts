import {
  buildRound1LayoutPrompt,
  normalizeRound1Form,
  round1FormSchema
} from "@/domain/round1";
import type {
  ImageGenerationSize,
  OpenAIImageAdapter
} from "@/infrastructure/image/openai-image-adapter";

// Landscape size that matches the top-down plan aspect ratio of the overlay.
export const DEFAULT_LAYOUT_IMAGE_SIZE: ImageGenerationSize = "1536x1024";

export type Round1LayoutImage = {
  model: string;
  imageBase64: string;
  prompt: string;
  size: ImageGenerationSize;
  salesEstimateOnly: true;
  notForProduction: true;
};

/**
 * Generates a Round 1 layout background. The deterministic core still owns
 * form validation, normalization, and prompt construction; the adapter only
 * renders the background. The result always carries the sales-estimate-only
 * and not-for-production invariants.
 */
export async function generateRound1LayoutImage(input: {
  form: unknown;
  adapter: OpenAIImageAdapter;
  size?: ImageGenerationSize;
}): Promise<Round1LayoutImage> {
  const form = round1FormSchema.parse(input.form);
  const { normalized } = normalizeRound1Form(form);
  const prompt = buildRound1LayoutPrompt(normalized);
  const size = input.size ?? DEFAULT_LAYOUT_IMAGE_SIZE;

  const result = await input.adapter.generateLayoutBackground({ prompt, size });

  return {
    model: result.model,
    imageBase64: result.imageBase64,
    prompt,
    size,
    salesEstimateOnly: true,
    notForProduction: true
  };
}
