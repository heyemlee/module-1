import { describe, expect, test, vi } from "vitest";
import {
  createCrsResponsesImageClient,
  extractImageB64
} from "./crs-responses-image-client";

// A minimal Responses SSE stream: a partial frame then the final full-res frame
// carried on the image_generation_call result (longer wins).
function sse(finalB64: string, partialB64 = "short") {
  return [
    `data: ${JSON.stringify({ type: "response.image_generation_call.partial_image", partial_image_b64: partialB64 })}`,
    `data: ${JSON.stringify({ type: "response.output_item.done", item: { type: "image_generation_call", result: finalB64 } })}`,
    "data: [DONE]",
    ""
  ].join("\n\n");
}

function okFetch(stream: string) {
  return vi.fn(
    async (_url: string, _init: RequestInit): Promise<Response> =>
      new Response(stream, { status: 200 })
  );
}

describe("extractImageB64", () => {
  test("returns the longest base64 frame from the stream", () => {
    expect(extractImageB64(sse("AAAAAAAAAA", "BB"))).toBe("AAAAAAAAAA");
  });

  test("returns null when no image frame is present", () => {
    expect(extractImageB64('data: {"type":"response.created"}\n\n')).toBeNull();
  });
});

describe("createCrsResponsesImageClient", () => {
  test("generate posts a streaming Responses request with the image tool", async () => {
    const fetchImpl = okFetch(sse("FINALIMAGE"));
    const client = createCrsResponsesImageClient({
      apiKey: "cr_test",
      baseUrl: "https://relay.example.com/openai/v1/",
      model: "gpt-5.5",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const result = await client.images.generate({
      model: "gpt-image-2",
      prompt: "a bright kitchen",
      size: "1024x1536",
      response_format: "b64_json"
    });

    expect(result.data?.[0]?.b64_json).toBe("FINALIMAGE");

    const [url, init] = fetchImpl.mock.calls[0];
    // Trailing slash trimmed, /responses appended to the /v1 base.
    expect(url).toBe("https://relay.example.com/openai/v1/responses");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer cr_test"
    );

    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(true);
    expect(body.model).toBe("gpt-5.5"); // driver model, not the REST image name
    expect(body.tools).toEqual([{ type: "image_generation", size: "1024x1536" }]);
    expect(body.input[0].content).toEqual([
      { type: "input_text", text: "a bright kitchen" }
    ]);
  });

  test("edit attaches reference views as input_image parts", async () => {
    const fetchImpl = okFetch(sse("EDITED"));
    const client = createCrsResponsesImageClient({
      apiKey: "cr_test",
      baseUrl: "https://relay.example.com/openai",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const result = await client.images.edit({
      model: "gpt-image-2",
      prompt: "render this plan",
      size: "1024x1024",
      referenceImagesBase64: ["PLAN64", "PERSP64"]
    });

    expect(result.data?.[0]?.b64_json).toBe("EDITED");

    const body = JSON.parse(
      fetchImpl.mock.calls[0][1].body as string
    );
    expect(body.input[0].content).toEqual([
      { type: "input_text", text: "render this plan" },
      { type: "input_image", image_url: "data:image/png;base64,PLAN64" },
      { type: "input_image", image_url: "data:image/png;base64,PERSP64" }
    ]);
  });

  test("throws on a non-200 relay response", async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"detail":"boom"}', { status: 400 })
    );
    const client = createCrsResponsesImageClient({
      apiKey: "cr_test",
      baseUrl: "https://relay.example.com/openai",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await expect(
      client.images.generate({
        model: "gpt-image-2",
        prompt: "x",
        size: "1024x1024",
        response_format: "b64_json"
      })
    ).rejects.toThrow(/status 400/);
  });
});
