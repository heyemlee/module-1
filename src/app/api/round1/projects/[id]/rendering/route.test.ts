import { describe, expect, test } from "vitest";
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

function buildSnapshotBody(doorColorId: string | null = null) {
  const form = createDefaultShowroomForm();
  form.renderingPreferences = {
    cabinetStyle: "EUROPEAN_FRAMELESS",
    doorColorId
  };
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

async function seedProjectWithSnapshot(doorColorId: string | null = null) {
  const id = await createProject();
  const snapshot = buildSnapshotBody(doorColorId);
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

  test("returns 409 when the snapshot has no selected door color", async () => {
    const { id } = await seedProjectWithSnapshot();

    const response = await renderRequest(id, { referenceImageBase64: "abc" });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.reason).toBe("DOOR_COLOR_REQUIRED");
  });

  test("returns a clear conflict when legacy rendering cannot resolve the color library", async () => {
    const { id } = await seedProjectWithSnapshot("eu-oak");
    const response = await renderRequest(id, { referenceImageBase64: "abc" });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.reason).toBe("PROJECT_COLOR_LIBRARY_REQUIRED");
  });

  test("does not persist a rendering from the legacy route when color metadata cannot be resolved", async () => {
    const { id } = await seedProjectWithSnapshot("eu-oak");
    await renderRequest(id, { referenceImageBase64: "abc" });

    const getResponse = await getProject(
      new Request(`http://localhost/api/round1/projects/${id}`),
      { params: Promise.resolve({ id }) }
    );
    const json = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(json.project.latestRendering).toBeUndefined();
    expect(json.project.snapshot.preliminaryCabinets).toBeDefined();
  });

  test("accepts a referenceImagesBase64 array before returning the legacy color-library conflict", async () => {
    const { id } = await seedProjectWithSnapshot("eu-oak");
    const response = await renderRequest(id, {
      referenceImagesBase64: ["top-down", "perspective"]
    });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.reason).toBe("PROJECT_COLOR_LIBRARY_REQUIRED");
  });

  test("returns 400 for an empty referenceImagesBase64 array", async () => {
    const response = await renderRequest("any", { referenceImagesBase64: [] });

    expect(response.status).toBe(400);
  });
});
