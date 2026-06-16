import { describe, expect, test } from "vitest";
import { createInMemoryRound1Repository } from "./round1-repository";

const formInput = {
  room: {
    length: 144,
    width: 120,
    dimensionsKnown: true,
    ceilingHeight: null,
    obstacles: []
  },
  openings: {
    doors: {
      status: "YES" as const,
      items: [{ location: "NEAR_ENTRANCE" as const, width: null }]
    },
    windows: {
      status: "YES" as const,
      items: [{ relation: "BEHIND_SINK" as const, width: null }]
    }
  },
  mep: {
    water: { relation: "NEAR_SINK" as const, movable: "UNKNOWN" as const },
    gas: { relation: "NEAR_RANGE" as const, movable: "UNKNOWN" as const },
    electric: { relation: "NEAR_FRIDGE" as const, movable: "UNKNOWN" as const },
    vent: { relation: "ABOVE_RANGE" as const, movable: "UNKNOWN" as const }
  },
  layoutPreference: "L_SHAPE" as const,
  fixtures: {
    sink: { size: 33 as const, type: "UNKNOWN", relation: "UNDER_WINDOW" as const },
    range: {
      size: 30 as const,
      fuel: "GAS",
      fixedLocation: "UNKNOWN" as const,
      relation: "NEAR_RANGE" as const
    },
    fridge: { size: 36 as const, type: "UNKNOWN", relation: "NEAR_ENTRANCE" as const },
    dishwasher: {
      status: "YES" as const,
      size: 24 as const,
      relation: "NEAR_SINK" as const
    },
    hood: { relation: "ABOVE_RANGE" as const }
  },
  layoutSensitiveCabinets: {
    cornerCabinet: { preferredType: "LAZY_SUSAN" as const },
    ovenMicrowave: {
      configuration: "RANGE_INCLUDES_OVEN" as const,
      relation: "NEAR_RANGE" as const
    },
    island: { requested: false, functions: [] }
  }
};

describe("Round 1 repository abstraction", () => {
  test("creates a project and saves normalized showroom intake", async () => {
    const repository = createInMemoryRound1Repository({
      createId: () => "round1_test"
    });

    const project = await repository.createProject({
      customerName: "Ada Customer"
    });
    const saved = await repository.saveShowroomForm(project.id, formInput);
    const loaded = await repository.getProject(project.id);

    expect(saved.normalized.salesEstimateOnly).toBe(true);
    expect(saved.normalized.notForProduction).toBe(true);
    expect(saved.readiness.canEnterProduction).toBe(false);
    expect(loaded?.customerName).toBe("Ada Customer");
    expect(loaded?.round1?.normalized.layoutPreference).toBe("L_SHAPE");
  });

  test("rejects saving intake to an unknown project", async () => {
    const repository = createInMemoryRound1Repository({
      createId: () => "round1_test"
    });

    await expect(repository.saveShowroomForm("missing", formInput)).rejects.toThrow(
      "Round 1 project not found"
    );
  });
});
