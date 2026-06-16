import { describe, expect, test } from "vitest";
import {
  createOpenAIImageAdapter,
  getOpenAIImageModel
} from "./openai-image-adapter";

describe("OpenAI image adapter", () => {
  test("defaults image model to gpt-image-2", () => {
    expect(getOpenAIImageModel({})).toBe("gpt-image-2");
  });

  test("uses OPENAI_IMAGE_MODEL when provided", () => {
    expect(getOpenAIImageModel({ OPENAI_IMAGE_MODEL: "gpt-image-3" })).toBe(
      "gpt-image-3"
    );
  });

  test("keeps image generation behind a dedicated adapter boundary", async () => {
    const calls: unknown[] = [];
    const adapter = createOpenAIImageAdapter({
      env: { OPENAI_IMAGE_MODEL: "gpt-image-test" },
      client: {
        images: {
          generate: async (input: unknown) => {
            calls.push(input);
            return { data: [{ b64_json: "base64-image" }] };
          }
        }
      }
    });

    const result = await adapter.generateLayoutBackground({
      prompt: "Create a clean top-down kitchen layout background.",
      size: "1024x1024"
    });

    expect(result).toEqual({
      model: "gpt-image-test",
      imageBase64: "base64-image"
    });
    expect(calls[0]).toMatchObject({
      model: "gpt-image-test",
      prompt: "Create a clean top-down kitchen layout background.",
      size: "1024x1024"
    });
  });
});
