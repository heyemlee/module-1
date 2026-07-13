import { describe, expect, test } from "vitest";
import { getAIStatus } from "./ai-status";

describe("getAIStatus", () => {
  test("reports configured OpenAI rendering and agent", () => {
    expect(
      getAIStatus({
        OPENAI_API_KEY_PRIMARY: "sk-test",
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

  test("reports rendering enabled when failover image keys are configured", () => {
    expect(
      getAIStatus({
        OPENAI_API_KEY_PRIMARY: "sk-primary",
        OPENAI_API_KEY_PRIORITY: "PRIMARY,SECONDARY,TERTIARY"
      })
    ).toMatchObject({
      renderingEnabled: true
    });
  });

  test("does not treat legacy OPENAI_API_KEY as configured", () => {
    expect(
      getAIStatus({
        OPENAI_API_KEY: "sk-legacy",
        LLM_PROVIDER: "openai"
      })
    ).toMatchObject({
      renderingEnabled: false,
      agentEnabled: false
    });
  });

  test("reports disabled features when keys are absent", () => {
    expect(getAIStatus({})).toMatchObject({
      renderingEnabled: false,
      agentEnabled: false
    });
  });
});
