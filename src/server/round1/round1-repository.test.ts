import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "@/features/round1/showroom-intake-data";
import { buildRound1Snapshot } from "@/features/round1/snapshot";
import {
  createFileSystemRound1Repository,
  createInMemoryRound1Repository
} from "./round1-repository";

function buildSnapshot() {
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
    sink: { status: "YES" as const, size: 33 as const, type: "UNKNOWN", relation: "UNDER_WINDOW" as const },
    range: {
      size: 30 as const,
      fuel: "GAS",
      fixedLocation: "UNKNOWN" as const,
      relation: "NEAR_RANGE" as const
    },
    fridge: { status: "YES" as const, size: 36 as const, type: "UNKNOWN", relation: "NEAR_ENTRANCE" as const },
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
    cookingAppliances: {
      range: { status: "YES" as const, relation: "BACK_SIDE" as const },
      cooktop: { status: "NO" as const, relation: "NOT_APPLICABLE" as const },
      wallOven: { status: "NO" as const, relation: "NOT_APPLICABLE" as const },
      microwaveOvenCombo: { status: "UNKNOWN" as const, relation: "UNKNOWN" as const }
    },
    island: { status: "NO" as const, requested: false, functions: [] }
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

  test("stores and returns a Round 1 snapshot", async () => {
    const repository = createInMemoryRound1Repository({
      createId: () => "round1_test"
    });
    const project = await repository.createProject({ customerName: "Ada" });
    const snapshot = buildSnapshot();

    await repository.saveSnapshot(project.id, snapshot);
    const loaded = await repository.getProject(project.id);

    expect(loaded?.snapshot?.cabinetFillGenerated).toBe(true);
    expect(loaded?.snapshot?.salesEstimateOnly).toBe(true);
    expect(loaded?.snapshot?.preliminaryCabinets.cabinets.length).toBe(
      snapshot.preliminaryCabinets.cabinets.length
    );
  });

  test("rejects saving a snapshot to an unknown project", async () => {
    const repository = createInMemoryRound1Repository();

    await expect(
      repository.saveSnapshot("missing", buildSnapshot())
    ).rejects.toThrow("Round 1 project not found");
  });

  test("stores a non-authoritative rendering with a createdAt stamp, separate from the snapshot", async () => {
    const repository = createInMemoryRound1Repository({
      now: () => new Date("2026-06-17T12:00:00.000Z")
    });
    const project = await repository.createProject({ customerName: "Ada" });

    const updated = await repository.saveRendering(project.id, {
      model: "gpt-image-2",
      imageBase64: "rendered-bytes",
      prompt: "concept",
      size: "1536x1024",
      basedOnSnapshotGeneratedAt: "2026-06-17T00:00:00.000Z",
      basedOnRenderingPreferences: {
        cabinetStyle: "EUROPEAN_FRAMELESS",
        doorColorId: "eu-oak",
        colorUpdatedAt: "2026-06-19T00:00:00.000Z"
      },
      salesEstimateOnly: true,
      notForProduction: true,
      dimensionConfidence: "ROUGH"
    });

    expect(updated.latestRendering?.createdAt).toBe("2026-06-17T12:00:00.000Z");

    const loaded = await repository.getProject(project.id);
    expect(loaded?.latestRendering?.imageBase64).toBe("rendered-bytes");
    expect(loaded?.latestRendering?.basedOnSnapshotGeneratedAt).toBe(
      "2026-06-17T00:00:00.000Z"
    );
    // The rendering must never leak into the authoritative snapshot field.
    expect(loaded?.snapshot).toBeUndefined();
  });

  test("rejects saving a rendering to an unknown project", async () => {
    const repository = createInMemoryRound1Repository();

    await expect(
      repository.saveRendering("missing", {
        model: "gpt-image-2",
        imageBase64: "x",
        prompt: "p",
        size: "1536x1024",
        basedOnSnapshotGeneratedAt: "2026-06-17T00:00:00.000Z",
        basedOnRenderingPreferences: {
          cabinetStyle: "EUROPEAN_FRAMELESS",
          doorColorId: "eu-oak",
          colorUpdatedAt: "2026-06-19T00:00:00.000Z"
        },
        salesEstimateOnly: true,
        notForProduction: true,
        dimensionConfidence: "ROUGH"
      })
    ).rejects.toThrow("Round 1 project not found");
  });
});

describe("File-system Round 1 repository", () => {
  const dir = mkdtempSync(join(tmpdir(), "round1-repo-"));
  const filePath = join(dir, "round1-projects.json");

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("persists a snapshot across repository instances", async () => {
    const writer = createFileSystemRound1Repository({ filePath });
    const project = await writer.createProject({ customerName: "Persisted" });
    await writer.saveSnapshot(project.id, buildSnapshot());

    // A fresh instance pointed at the same file reads what was written,
    // proving the data survives beyond in-process state.
    const reader = createFileSystemRound1Repository({ filePath });
    const loaded = await reader.getProject(project.id);

    expect(loaded?.customerName).toBe("Persisted");
    expect(loaded?.snapshot?.cabinetFillGenerated).toBe(true);
    expect(loaded?.snapshot?.dimensionConfidence).toBe("ROUGH");
  });

  test("returns null for an unknown project before anything is written", async () => {
    const repository = createFileSystemRound1Repository({
      filePath: join(dir, "missing-store.json")
    });

    expect(await repository.getProject("nope")).toBeNull();
  });
});
