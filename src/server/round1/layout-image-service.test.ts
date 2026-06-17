import { describe, expect, test, vi } from "vitest";
import { createDefaultShowroomForm } from "@/features/round1/showroom-intake-data";
import type {
  GenerateLayoutBackgroundInput,
  OpenAIImageAdapter
} from "@/infrastructure/image/openai-image-adapter";
import {
  DEFAULT_LAYOUT_IMAGE_SIZE,
  generateRound1LayoutImage
} from "./layout-image-service";

describe("generateRound1LayoutImage", () => {
  test("builds the Round 1 prompt, calls the adapter, and stamps invariants", async () => {
    const calls: GenerateLayoutBackgroundInput[] = [];
    const adapter: OpenAIImageAdapter = {
      async generateLayoutBackground(input) {
        calls.push(input);
        return { model: "gpt-image-test", imageBase64: "base64-image" };
      },
      async generateConceptRendering() {
        throw new Error("not used in this test");
      }
    };

    const result = await generateRound1LayoutImage({
      form: createDefaultShowroomForm(),
      adapter
    });

    expect(result.model).toBe("gpt-image-test");
    expect(result.imageBase64).toBe("base64-image");
    expect(result.size).toBe(DEFAULT_LAYOUT_IMAGE_SIZE);
    expect(result.salesEstimateOnly).toBe(true);
    expect(result.notForProduction).toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0].size).toBe(DEFAULT_LAYOUT_IMAGE_SIZE);
    expect(calls[0].prompt).toContain(
      "Round 1 customer confirmation"
    );
    expect(calls[0].prompt).toContain("sales-estimate-only");
  });

  test("rejects an invalid form before calling the adapter", async () => {
    const generateLayoutBackground = vi.fn();
    const adapter = { generateLayoutBackground } as unknown as OpenAIImageAdapter;

    await expect(
      generateRound1LayoutImage({ form: { bogus: true }, adapter })
    ).rejects.toThrow();
    expect(generateLayoutBackground).not.toHaveBeenCalled();
  });
});
