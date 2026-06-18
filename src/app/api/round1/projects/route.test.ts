import { describe, expect, test } from "vitest";
import { POST } from "./route";

const showroomForm = {
  room: {
    length: 144,
    width: 120,
    dimensionsKnown: true,
    ceilingHeight: null,
    obstacles: []
  },
  openings: {
    doors: [{ location: "NEAR_ENTRANCE", width: null }],
    windows: [{ relation: "BEHIND_SINK", width: null }]
  },
  mep: {
    water: { relation: "NEAR_SINK", movable: "UNKNOWN" },
    gas: { relation: "NEAR_RANGE", movable: "UNKNOWN" },
    electric: { relation: "NEAR_FRIDGE", movable: "UNKNOWN" },
    vent: { relation: "ABOVE_RANGE", movable: "UNKNOWN" }
  },
  layoutPreference: "L_SHAPE",
  fixtures: {
    sink: { size: 33, type: "UNKNOWN", relation: "UNDER_WINDOW" },
    range: { size: 30, fuel: "GAS", fixedLocation: "UNKNOWN" },
    fridge: { size: 36, type: "UNKNOWN", relation: "NEAR_ENTRANCE" },
    dishwasher: { size: 24, relation: "NEAR_SINK" },
    hood: { relation: "ABOVE_RANGE" }
  },
  layoutSensitiveCabinets: {
    cornerCabinet: { preferredType: "NO_PREFERENCE" },
    ovenMicrowave: { configuration: "UNKNOWN" },
    island: { status: "NO", requested: false, functions: [] }
  }
};

describe("POST /api/round1/projects", () => {
  test("creates a project and returns normalized Round 1 intake when form is supplied", async () => {
    const response = await POST(
      new Request("http://localhost/api/round1/projects", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ada Customer",
          showroomForm
        })
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.project.customerName).toBe("Ada Customer");
    expect(json.round1.normalized.salesEstimateOnly).toBe(true);
    expect(json.round1.normalized.notForProduction).toBe(true);
    expect(json.round1.readiness.canEnterProduction).toBe(false);
    expect(json.round1.confirmationItems.length).toBeGreaterThan(0);
  });

  test("returns 400 for missing customer name", async () => {
    const response = await POST(
      new Request("http://localhost/api/round1/projects", {
        method: "POST",
        body: JSON.stringify({})
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid Round 1 project request");
  });
});
