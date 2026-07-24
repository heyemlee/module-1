export type ImageGenerationSize = "1024x1024" | "1536x1024" | "1024x1536";

export type GenerateConceptRenderingInput = {
  prompt: string;
  size: ImageGenerationSize;
  /**
   * One or more base64-encoded PNGs of the deterministic reference views (no
   * data: prefix), e.g. a clean top-down plan and, later, a perspective view.
   * All are sent to the image model as spatial references for the same prompt.
   */
  referenceImagesBase64: string[];
};

export type GenerateConceptRenderingResult = {
  model: string;
  imageBase64: string;
};

export type ImageClient = {
  images: {
    /**
     * Image+text edit. Used for the customer concept rendering, where the
     * deterministic floor plan is supplied as the spatial reference image and
     * the prompt carries the semantic/material context.
     */
    edit(input: {
      model: string;
      prompt: string;
      size: ImageGenerationSize;
      referenceImagesBase64: string[];
    }): Promise<{ data?: Array<{ b64_json?: string }> }>;
  };
};

export type OpenAIImageAdapter = {
  /**
   * Generates a customer-facing concept rendering from BOTH the deterministic
   * floor plan reference image and a JSON-derived prompt. The result is a
   * concept preview only and is never authoritative for cabinet data.
   */
  generateConceptRendering(
    input: GenerateConceptRenderingInput
  ): Promise<GenerateConceptRenderingResult>;
};

export function getOpenAIImageModel(
  env: Record<string, string | undefined>
): string {
  return env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
}

export function createOpenAIImageAdapter(input: {
  env?: Record<string, string | undefined>;
  client: ImageClient;
}): OpenAIImageAdapter {
  const env = input.env ?? process.env;

  return {
    async generateConceptRendering(request) {
      const model = getOpenAIImageModel(env);
      const response = await input.client.images.edit({
        model,
        prompt: request.prompt,
        size: request.size,
        referenceImagesBase64: request.referenceImagesBase64
      });
      const imageBase64 = response.data?.[0]?.b64_json;

      if (!imageBase64) {
        throw new Error("OpenAI image edit did not return image data");
      }

      return { model, imageBase64 };
    }
  };
}
