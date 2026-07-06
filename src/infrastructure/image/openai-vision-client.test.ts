import { describe, expect, test, vi } from "vitest";
import { createVisionClientFromEnv } from "./openai-vision-client";

function okVisionResponse(text: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: text } }] }),
    { status: 200 }
  );
}

describe("createVisionClientFromEnv", () => {
  test("returns null when prioritized OpenAI API keys are absent", () => {
    expect(createVisionClientFromEnv({})).toBeNull();
    expect(createVisionClientFromEnv({ OPENAI_API_KEY: "sk-legacy" })).toBeNull();
  });

  test("uses the first configured key from OPENAI_API_KEY_PRIORITY", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(okVisionResponse("ok"));

    const client = createVisionClientFromEnv(
      {
        OPENAI_API_KEY_PRIMARY: "sk-primary",
        OPENAI_API_KEY_SECONDARY: "sk-secondary",
        OPENAI_API_KEY_PRIORITY: "SECONDARY,PRIMARY"
      },
      { fetchImpl }
    );
    expect(client).not.toBeNull();
    if (!client) throw new Error("expected vision client");

    await client.analyze({ prompt: "check", imageBase64: "image" });

    expect((fetchImpl.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer sk-secondary"
    });
  });
});
