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
import { POST } from "../../route";
import { GET } from "../route";
import { PUT } from "./route";

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
  const response = await POST(
    new Request("http://localhost/api/round1/projects", {
      method: "POST",
      body: JSON.stringify({ customerName: "Ada Customer" })
    })
  );
  const json = await response.json();
  return json.project.id as string;
}

describe("PUT /api/round1/projects/[id]/snapshot", () => {
  test("persists the snapshot so it is returned when the project is fetched", async () => {
    const id = await createProject();
    const snapshot = buildSnapshotBody();

    const putResponse = await PUT(
      new Request(`http://localhost/api/round1/projects/${id}/snapshot`, {
        method: "PUT",
        body: JSON.stringify(snapshot)
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(putResponse.status).toBe(200);

    const getResponse = await GET(
      new Request(`http://localhost/api/round1/projects/${id}`),
      { params: Promise.resolve({ id }) }
    );
    const json = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(json.project.snapshot.cabinetFillGenerated).toBe(true);
    expect(json.project.snapshot.salesEstimateOnly).toBe(true);
    expect(json.project.snapshot.notForProduction).toBe(true);
    expect(json.project.snapshot.preliminaryCabinets.cabinets.length).toBe(
      snapshot.preliminaryCabinets.cabinets.length
    );
  });

  test("returns 404 when saving a snapshot to an unknown project", async () => {
    const response = await PUT(
      new Request("http://localhost/api/round1/projects/missing/snapshot", {
        method: "PUT",
        body: JSON.stringify(buildSnapshotBody())
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Round 1 project not found");
  });

  test("rejects a snapshot that is not a generated sales-only artifact", async () => {
    const id = await createProject();
    const snapshot = { ...buildSnapshotBody(), cabinetFillGenerated: false };

    const response = await PUT(
      new Request(`http://localhost/api/round1/projects/${id}/snapshot`, {
        method: "PUT",
        body: JSON.stringify(snapshot)
      }),
      { params: Promise.resolve({ id }) }
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid Round 1 snapshot");
  });
});
