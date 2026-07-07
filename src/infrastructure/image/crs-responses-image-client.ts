import type {
  ImageClient,
  ImageGenerationSize
} from "./openai-image-adapter";

type FetchImpl = typeof fetch;

// The CRS relay (claude-relay) only exposes the OpenAI *Responses* API and
// forces `stream: true`; it has no `/images/generations` or `/images/edits`
// route. Image output comes from the built-in `image_generation` tool, exactly
// how codex produces images through the same relay. This client speaks that
// wire while satisfying the same `ImageClient` boundary the REST client does,
// so the adapter and the route stay untouched.

// Image generation streams for a while (agent turn + tool render). Give it more
// headroom than the REST client's 90s so a real render isn't cut off.
const REQUEST_TIMEOUT_MS = 180_000;

// The Responses model is the *driver* agent (it calls the image tool), not the
// image model name — so the REST default "gpt-image-2" is wrong here.
const DEFAULT_RESPONSES_MODEL = "gpt-5.5";

/**
 * Pull the final image out of the Responses SSE stream. The relay emits partial
 * frames (`partial_image_b64`) plus a final `image_generation_call` result; the
 * final full-res frame is the longest base64 we see, so keep the longest.
 */
export function extractImageB64(sse: string): string | null {
  let best = "";
  for (const line of sse.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    let evt: unknown;
    try {
      evt = JSON.parse(payload);
    } catch {
      continue;
    }
    const e = evt as {
      result?: unknown;
      partial_image_b64?: unknown;
      item?: { result?: unknown };
    };
    for (const cand of [e.result, e.partial_image_b64, e.item?.result]) {
      if (typeof cand === "string" && cand.length > best.length) best = cand;
    }
  }
  return best || null;
}

async function runImageResponse(
  cfg: { baseUrl: string; apiKey: string; model: string; fetchImpl: FetchImpl },
  content: Array<Record<string, unknown>>,
  size: ImageGenerationSize
): Promise<{ data?: Array<{ b64_json?: string }> }> {
  const body = {
    stream: true,
    model: cfg.model,
    input: [{ role: "user", content }],
    tools: [{ type: "image_generation", size }]
  };

  let response: Response;
  try {
    response = await cfg.fetchImpl(`${cfg.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error(
        `Relay image request timed out after ${Math.round(
          REQUEST_TIMEOUT_MS / 1000
        )}s`
      );
    }
    throw error;
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Relay image request failed with status ${response.status}: ${text.slice(
        0,
        300
      )}`
    );
  }

  const b64 = extractImageB64(text);
  return { data: b64 ? [{ b64_json: b64 }] : [] };
}

/**
 * Builds an `ImageClient` that generates images through the CRS relay's
 * Responses API. `generate` sends a text-only prompt; `edit` attaches the
 * deterministic reference views as `input_image` parts so the model uses them
 * as spatial references — the image+text edit equivalent on this wire.
 */
export function createCrsResponsesImageClient(input: {
  apiKey: string;
  baseUrl: string;
  model?: string;
  fetchImpl?: FetchImpl;
}): ImageClient {
  const cfg = {
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    apiKey: input.apiKey,
    model: input.model?.trim() || DEFAULT_RESPONSES_MODEL,
    fetchImpl: input.fetchImpl ?? globalThis.fetch
  };

  return {
    images: {
      // The Responses driver model comes from cfg, not `request.model` (that is
      // the REST-only "gpt-image-2" name, meaningless as a driver agent).
      generate(request) {
        return runImageResponse(
          cfg,
          [{ type: "input_text", text: request.prompt }],
          request.size
        );
      },
      edit(request) {
        const content: Array<Record<string, unknown>> = [
          { type: "input_text", text: request.prompt }
        ];
        for (const b64 of request.referenceImagesBase64) {
          content.push({
            type: "input_image",
            image_url: `data:image/png;base64,${b64}`
          });
        }
        return runImageResponse(cfg, content, request.size);
      }
    }
  };
}
