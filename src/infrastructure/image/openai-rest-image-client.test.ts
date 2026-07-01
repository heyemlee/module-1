import { describe, expect, test, vi } from "vitest";
import {
  createOpenAIImageAdapterFromEnv,
  createOpenAIRestImageClient
} from "./openai-rest-image-client";

function okFetch(b64: string) {
  return vi.fn(
    async (_url: string, _init: RequestInit): Promise<Response> =>
      new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), {
        status: 200
      })
  );
}

describe("createOpenAIRestImageClient", () => {
  test("posts to the OpenAI images endpoint and parses b64_json", async () => {
    const fetchImpl = okFetch("abc");
    const client = createOpenAIRestImageClient({
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const result = await client.images.generate({
      model: "dall-e-3",
      prompt: "top-down kitchen",
      size: "1024x1024",
      response_format: "b64_json"
    });

    expect(result.data?.[0]?.b64_json).toBe("abc");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test"
    );

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("dall-e-3");
    expect(body.prompt).toBe("top-down kitchen");
    // Legacy models keep response_format.
    expect(body.response_format).toBe("b64_json");
  });

  test("omits response_format for gpt-image models", async () => {
    const fetchImpl = okFetch("z");
    const client = createOpenAIRestImageClient({
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await client.images.generate({
      model: "gpt-image-2",
      prompt: "p",
      size: "1536x1024",
      response_format: "b64_json"
    });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.model).toBe("gpt-image-2");
    expect(body.response_format).toBeUndefined();
  });

  test("trims trailing slashes from a custom base URL", async () => {
    const fetchImpl = okFetch("z");
    const client = createOpenAIRestImageClient({
      apiKey: "sk-test",
      baseUrl: "https://proxy.example.com/v1/",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await client.images.generate({
      model: "gpt-image-2",
      prompt: "p",
      size: "1024x1024",
      response_format: "b64_json"
    });

    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://proxy.example.com/v1/images/generations"
    );
  });

  test("posts a multipart edit request to the edits endpoint", async () => {
    const fetchImpl = okFetch("edited");
    const client = createOpenAIRestImageClient({
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const result = await client.images.edit({
      model: "gpt-image-2",
      prompt: "concept kitchen",
      size: "1536x1024",
      referenceImagesBase64: [Buffer.from("png-bytes").toString("base64")]
    });

    expect(result.data?.[0]?.b64_json).toBe("edited");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test"
    );
    // Multipart body: fetch derives the Content-Type boundary itself, so the
    // client must not hardcode JSON. The body is a FormData instance.
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-image-2");
    expect(form.get("prompt")).toBe("concept kitchen");
    expect(form.get("size")).toBe("1536x1024");
    // A single reference uses the classic `image` field only (no `image[]`),
    // because the API rejects sending both.
    expect(form.get("image")).toBeInstanceOf(Blob);
    expect(form.getAll("image[]")).toHaveLength(0);
    // gpt-image models return base64 by default and reject response_format.
    expect(form.get("response_format")).toBeNull();
    // gpt-image-2 currently rejects this field with
    // `invalid_input_fidelity_model`.
    expect(form.get("input_fidelity")).toBeNull();
  });

  test("uses image[] parts (and no single image) for multiple references", async () => {
    const fetchImpl = okFetch("edited");
    const client = createOpenAIRestImageClient({
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await client.images.edit({
      model: "gpt-image-2",
      prompt: "concept kitchen",
      size: "1536x1024",
      referenceImagesBase64: [
        Buffer.from("top-down").toString("base64"),
        Buffer.from("perspective").toString("base64")
      ]
    });

    const form = fetchImpl.mock.calls[0][1].body as FormData;
    const images = form.getAll("image[]");
    expect(images).toHaveLength(2);
    images.forEach((image) => expect(image).toBeInstanceOf(Blob));
    // With multiple references, no single legacy `image` part is added.
    expect(form.get("image")).toBeNull();
  });

  test("throws with the status code on a failed response", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init: RequestInit): Promise<Response> =>
        new Response("invalid api key", { status: 401 })
    );
    const client = createOpenAIRestImageClient({
      apiKey: "sk-bad",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await expect(
      client.images.generate({
        model: "gpt-image-2",
        prompt: "p",
        size: "1024x1024",
        response_format: "b64_json"
      })
    ).rejects.toThrow(/401/);
  });
});

describe("createOpenAIImageAdapterFromEnv", () => {
  test("returns null when OPENAI_API_KEY is absent", () => {
    expect(createOpenAIImageAdapterFromEnv({})).toBeNull();
    expect(createOpenAIImageAdapterFromEnv({ OPENAI_API_KEY: "  " })).toBeNull();
  });

  test("returns an adapter when OPENAI_API_KEY is present", () => {
    const adapter = createOpenAIImageAdapterFromEnv({ OPENAI_API_KEY: "sk-test" });
    expect(adapter).not.toBeNull();
  });
});
