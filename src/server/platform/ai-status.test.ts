import { describe, expect, test } from "vitest";
import { getAIStatus } from "./ai-status";

describe("getAIStatus", () => {
  test("reports configured OpenAI rendering and agent", () => {
    expect(
      getAIStatus({
        OPENAI_API_KEY: "sk-test",
        OPENAI_IMAGE_MODEL: "gpt-image-2",
        LLM_PROVIDER: "openai",
        OPENAI_MODEL: "gpt-4o-mini"
      })
    ).toEqual({
      renderingEnabled: true,
      agentEnabled: true,
      provider: "openai",
      chatModel: "gpt-4o-mini",
      imageModel: "gpt-image-2"
    });
  });

  test("reports disabled features when keys are absent", () => {
    expect(getAIStatus({})).toMatchObject({
      renderingEnabled: false,
      agentEnabled: false
    });
  });
});
