import { afterEach, describe, expect, test, vi } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "@/features/round1/showroom-intake-data";
import { buildRound1Snapshot } from "@/features/round1/snapshot";
import { POST as createProjectPOST } from "../../route";
import { GET as getProject } from "../route";
import { PUT as putSnapshot } from "../snapshot/route";
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

function buildSnapshotBody() {
  const form = createDefaultShowroomForm();
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildRound1Snapshot({
    showroomForm: form,
    normalized: result.normalized,
    positionOverrides: {},
    preliminaryCabinets: estimate,
    confirmationItems: [
      ...result.confirmationItems,
      ...estimate.confirmationItems
    ],
    readiness: result.readiness
  });
}

async function createProject() {
  const response = await createProjectPOST(
    new Request("http://localhost/api/round1/projects", {
      method: "POST",
      body: JSON.stringify({ customerName: "Ada Customer" })
    })
  );
  const json = await response.json();
  return json.project.id as string;
}

async function seedProjectWithSnapshot() {
  const id = await createProject();
  const snapshot = buildSnapshotBody();
  await putSnapshot(
    new Request(`http://localhost/api/round1/projects/${id}/snapshot`, {
      method: "PUT",
      body: JSON.stringify(snapshot)
    }),
    { params: Promise.resolve({ id }) }
  );
  return { id, snapshot };
}

function renderRequest(id: string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/round1/projects/${id}/rendering`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("POST /api/round1/projects/[id]/rendering", () => {
  test("returns 400 when the reference image is missing", async () => {
    const response = await renderRequest("any", {});
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid Round 1 rendering request");
  });

  test("returns 404 for an unknown project", async () => {
    const response = await renderRequest("does-not-exist", {
      referenceImageBase64: "abc"
    });

    expect(response.status).toBe(404);
  });

  test("returns 409 when the project has no snapshot yet", async () => {
    const id = await createProject();

    const response = await renderRequest(id, { referenceImageBase64: "abc" });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.reason).toBe("NO_SNAPSHOT");
  });

  test("returns 503 when OPENAI_API_KEY is not configured", async () => {
    const { id } = await seedProjectWithSnapshot();
    delete process.env.OPENAI_API_KEY;

    const response = await renderRequest(id, { referenceImageBase64: "abc" });
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.reason).toBe("OPENAI_API_KEY_NOT_CONFIGURED");
  });

  test("returns the concept rendering and non-authoritative flags when configured", async () => {
    const { id, snapshot } = await seedProjectWithSnapshot();
    process.env.OPENAI_API_KEY = "sk-test";
    globalThis.fetch = vi.fn(
      async (): Promise<Response> =>
        new Response(JSON.stringify({ data: [{ b64_json: "rendered" }] }), {
          status: 200
        })
    ) as unknown as typeof fetch;

    const response = await renderRequest(id, { referenceImageBase64: "abc" });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.imageBase64).toBe("rendered");
    expect(json.salesEstimateOnly).toBe(true);
    expect(json.notForProduction).toBe(true);
    expect(json.dimensionConfidence).toBe("ROUGH");
    expect(json.basedOnSnapshotGeneratedAt).toBe(snapshot.generatedAt);
    // Persisted as a non-authoritative preview with a createdAt stamp.
    expect(typeof json.createdAt).toBe("string");
  });

  test("persists the rendering so it is returned with the project (non-authoritative)", async () => {
    const { id } = await seedProjectWithSnapshot();
    process.env.OPENAI_API_KEY = "sk-test";
    globalThis.fetch = vi.fn(
      async (): Promise<Response> =>
        new Response(JSON.stringify({ data: [{ b64_json: "rendered" }] }), {
          status: 200
        })
    ) as unknown as typeof fetch;

    await renderRequest(id, { referenceImageBase64: "abc" });

    const getResponse = await getProject(
      new Request(`http://localhost/api/round1/projects/${id}`),
      { params: Promise.resolve({ id }) }
    );
    const json = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(json.project.latestRendering.imageBase64).toBe("rendered");
    // The preview is stored separately and never inside the authoritative snapshot.
    expect(json.project.snapshot.preliminaryCabinets).toBeDefined();
    expect("latestRendering" in json.project.snapshot).toBe(false);
  });

  test("accepts a referenceImagesBase64 array of multiple views", async () => {
    const { id } = await seedProjectWithSnapshot();
    process.env.OPENAI_API_KEY = "sk-test";
    globalThis.fetch = vi.fn(
      async (): Promise<Response> =>
        new Response(JSON.stringify({ data: [{ b64_json: "rendered" }] }), {
          status: 200
        })
    ) as unknown as typeof fetch;

    const response = await renderRequest(id, {
      referenceImagesBase64: ["top-down", "perspective"]
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.imageBase64).toBe("rendered");
  });

  test("returns 400 for an empty referenceImagesBase64 array", async () => {
    const response = await renderRequest("any", { referenceImagesBase64: [] });

    expect(response.status).toBe(400);
  });
});
