import { afterEach, describe, expect, test, vi } from "vitest";
import { createDefaultShowroomForm } from "@/features/round1/showroom-intake-data";
import { POST } from "./route";

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalKey;
  }
});

function request(body: unknown) {
  return new Request("http://localhost/api/round1/layout-image", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("POST /api/round1/layout-image", () => {
  test("returns 503 when OPENAI_API_KEY is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const response = await POST(request({ form: createDefaultShowroomForm() }));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.reason).toBe("OPENAI_API_KEY_NOT_CONFIGURED");
  });

  test("returns 400 for an invalid form even when configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test";

    const response = await POST(request({ form: { bogus: true } }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid Round 1 layout image request");
  });

  test("returns the generated background and invariants when configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    globalThis.fetch = vi.fn(
      async (): Promise<Response> =>
        new Response(JSON.stringify({ data: [{ b64_json: "img-data" }] }), {
          status: 200
        })
    ) as unknown as typeof fetch;

    const response = await POST(request({ form: createDefaultShowroomForm() }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.imageBase64).toBe("img-data");
    expect(json.salesEstimateOnly).toBe(true);
    expect(json.notForProduction).toBe(true);
    expect(json.prompt).toContain("Round 1 customer confirmation");
  });
});
