import { describe, expect, test, vi } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "@/features/round1/showroom-intake-data";
import {
  buildRound1Snapshot,
  type Round1Snapshot
} from "@/features/round1/snapshot";
import type {
  GenerateConceptRenderingInput,
  OpenAIImageAdapter
} from "@/infrastructure/image/openai-image-adapter";
import {
  DEFAULT_RENDERING_SIZE,
  generateRound1Rendering
} from "./rendering-service";

function buildSnapshot(): Round1Snapshot {
  const form = createDefaultShowroomForm();
  const { normalized, confirmationItems, readiness } =
    normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildRound1Snapshot({
    showroomForm: form,
    normalized,
    positionOverrides: {},
    preliminaryCabinets: estimate,
    confirmationItems: [...confirmationItems, ...estimate.confirmationItems],
    readiness,
    now: () => new Date("2026-06-17T00:00:00.000Z")
  });
}

describe("generateRound1Rendering", () => {
  test("builds the prompt, forwards the reference image, and stamps non-authoritative flags", async () => {
    const calls: GenerateConceptRenderingInput[] = [];
    const adapter: OpenAIImageAdapter = {
      async generateLayoutBackground() {
        throw new Error("not used in this test");
      },
      async generateConceptRendering(input) {
        calls.push(input);
        return { model: "gpt-image-test", imageBase64: "rendered" };
      }
    };

    const snapshot = buildSnapshot();
    const result = await generateRound1Rendering({
      snapshot,
      referenceImagesBase64: ["plan-png"],
      adapter
    });

    expect(result.model).toBe("gpt-image-test");
    expect(result.imageBase64).toBe("rendered");
    expect(result.size).toBe(DEFAULT_RENDERING_SIZE);
    expect(result.salesEstimateOnly).toBe(true);
    expect(result.notForProduction).toBe(true);
    expect(result.dimensionConfidence).toBe("ROUGH");
    expect(result.basedOnSnapshotGeneratedAt).toBe(snapshot.generatedAt);

    expect(calls).toHaveLength(1);
    expect(calls[0].referenceImagesBase64).toEqual(["plan-png"]);
    expect(calls[0].size).toBe(DEFAULT_RENDERING_SIZE);
    expect(calls[0].prompt).toContain("concept rendering");
    expect(calls[0].prompt).toContain("sales-estimate concept image only");
  });

  test("rejects a missing reference image before calling the adapter", async () => {
    const generateConceptRendering = vi.fn();
    const adapter = {
      generateConceptRendering
    } as unknown as OpenAIImageAdapter;

    await expect(
      generateRound1Rendering({
        snapshot: buildSnapshot(),
        referenceImagesBase64: [],
        adapter
      })
    ).rejects.toThrow();
    expect(generateConceptRendering).not.toHaveBeenCalled();
  });
});
