export type ImageGenerationSize = "1024x1024" | "1536x1024" | "1024x1536";

export type GenerateLayoutBackgroundInput = {
  prompt: string;
  size: ImageGenerationSize;
};

export type GenerateLayoutBackgroundResult = {
  model: string;
  imageBase64: string;
};

export type ImageClient = {
  images: {
    generate(input: {
      model: string;
      prompt: string;
      size: ImageGenerationSize;
      response_format: "b64_json";
    }): Promise<{ data?: Array<{ b64_json?: string }> }>;
  };
};

export type OpenAIImageAdapter = {
  generateLayoutBackground(
    input: GenerateLayoutBackgroundInput
  ): Promise<GenerateLayoutBackgroundResult>;
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
    async generateLayoutBackground(request) {
      const model = getOpenAIImageModel(env);
      const response = await input.client.images.generate({
        model,
        prompt: request.prompt,
        size: request.size,
        response_format: "b64_json"
      });
      const imageBase64 = response.data?.[0]?.b64_json;

      if (!imageBase64) {
        throw new Error("OpenAI image generation did not return image data");
      }

      return { model, imageBase64 };
    }
  };
}
