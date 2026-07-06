import type { VisionClient } from "@/server/round1/rendering-verification";
import { getPreferredOpenAIApiKey } from "@/infrastructure/openai-api-keys";

type FetchImpl = typeof fetch;

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Fetch-based OpenAI vision client for rendering verification (chat completions
 * with an image part). Kept separate from the image-generation client and
 * dependency-injected into `verifyConceptRendering` so it can be faked in tests.
 */
export function createOpenAIVisionClient(input: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: FetchImpl;
}): VisionClient {
  const baseUrl = (input.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const model = input.model ?? "gpt-4o";

  return {
    async analyze({ prompt, imageBase64 }) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:image/png;base64,${imageBase64}` }
                }
              ]
            }
          ]
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        throw new Error(`OpenAI vision request failed with status ${response.status}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return json.choices?.[0]?.message?.content ?? "";
    }
  };
}

export function createVisionClientFromEnv(
  env: Record<string, string | undefined> = process.env,
  deps: { fetchImpl?: FetchImpl } = {}
): VisionClient | null {
  const apiKey = getPreferredOpenAIApiKey(env)?.apiKey;
  if (!apiKey) return null;
  return createOpenAIVisionClient({
    apiKey,
    baseUrl: env.OPENAI_BASE_URL?.trim() || undefined,
    model: env.ROUND1_VERIFY_MODEL?.trim() || "gpt-4o",
    fetchImpl: deps.fetchImpl
  });
}
