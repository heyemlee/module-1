import {
  createOpenAIImageAdapter,
  type ImageClient,
  type OpenAIImageAdapter
} from "./openai-image-adapter";

type FetchImpl = typeof fetch;

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Real OpenAI Images API client built on `fetch`, so the MVP can call live
 * image generation without adding an SDK dependency. It conforms to the
 * `ImageClient` boundary that `createOpenAIImageAdapter` already expects.
 */
export function createOpenAIRestImageClient(input: {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchImpl;
}): ImageClient {
  const baseUrl = (input.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  return {
    images: {
      async generate(request) {
        const body: Record<string, unknown> = {
          model: request.model,
          prompt: request.prompt,
          size: request.size,
          n: 1
        };

        // gpt-image-* models always return base64 and reject `response_format`.
        // Only forward it for legacy models (e.g. dall-e-3) that require it.
        if (!request.model.startsWith("gpt-image")) {
          body.response_format = request.response_format;
        }

        const response = await fetchImpl(`${baseUrl}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const detail = await safeReadError(response);
          throw new Error(
            `OpenAI image request failed with status ${response.status}${
              detail ? `: ${detail}` : ""
            }`
          );
        }

        return (await response.json()) as {
          data?: Array<{ b64_json?: string }>;
        };
      },

      async edit(request) {
        // Image+text edit uses multipart/form-data. The deterministic floor
        // plan PNG is the spatial reference; the prompt carries semantics.
        const form = new FormData();
        form.append("model", request.model);
        form.append("prompt", request.prompt);
        form.append("size", request.size);
        form.append("n", "1");
        // gpt-image-* return base64 by default and reject `response_format`.
        if (!request.model.startsWith("gpt-image")) {
          form.append("response_format", "b64_json");
        }
        // A single reference uses the classic `image` field; multiple references
        // use repeated `image[]` parts (clean top-down + optional perspective).
        // The API rejects sending BOTH `image` and `image[]` ("parameter already
        // has a different value"), so pick exactly one shape by count.
        const images = request.referenceImagesBase64;
        if (images.length === 1) {
          const bytes = Buffer.from(images[0], "base64");
          form.append(
            "image",
            new Blob([bytes], { type: "image/png" }),
            "floor-plan.png"
          );
        } else {
          images.forEach((b64, index) => {
            const bytes = Buffer.from(b64, "base64");
            form.append(
              "image[]",
              new Blob([bytes], { type: "image/png" }),
              `reference-${index}.png`
            );
          });
        }

        const response = await fetchImpl(`${baseUrl}/images/edits`, {
          method: "POST",
          // No explicit Content-Type: fetch sets the multipart boundary.
          headers: { Authorization: `Bearer ${input.apiKey}` },
          body: form
        });

        if (!response.ok) {
          const detail = await safeReadError(response);
          throw new Error(
            `OpenAI image edit failed with status ${response.status}${
              detail ? `: ${detail}` : ""
            }`
          );
        }

        return (await response.json()) as {
          data?: Array<{ b64_json?: string }>;
        };
      }
    }
  };
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

/**
 * Builds a live OpenAI image adapter from environment configuration. Returns
 * `null` when `OPENAI_API_KEY` is absent so callers can fall back to the
 * deterministic mock background instead of failing.
 */
export function createOpenAIImageAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
  deps: { fetchImpl?: FetchImpl } = {}
): OpenAIImageAdapter | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const client = createOpenAIRestImageClient({
    apiKey,
    baseUrl: env.OPENAI_BASE_URL?.trim() || undefined,
    fetchImpl: deps.fetchImpl
  });

  return createOpenAIImageAdapter({ env, client });
}
