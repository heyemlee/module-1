import sharp from "sharp";
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
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import type {
  GenerateConceptRenderingInput,
  OpenAIImageAdapter
} from "@/infrastructure/image/openai-image-adapter";
import {
  DEFAULT_RENDERING_SIZE,
  generateRound1Rendering
} from "./rendering-service";
import {
  TARGET_RENDERING_HEIGHT,
  TARGET_RENDERING_WIDTH
} from "./rendering-image-normalization";

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

const europeanOak: CabinetColor = {
  id: "eu-oak",
  companyId: "company-1",
  cabinetStyle: "EUROPEAN_FRAMELESS",
  name: "European Oak",
  colorCode: null,
  swatchImageUrl: null,
  swatchHex: "#b98a58",
  hoverExampleImageUrl: null,
  promptDescription: "warm natural oak matte slab cabinet doors",
  active: true,
  sortOrder: 1,
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-19T00:00:00.000Z"
};

describe("generateRound1Rendering", () => {
  test("builds the prompt, forwards the reference image, and stamps non-authoritative flags", async () => {
    const calls: GenerateConceptRenderingInput[] = [];
    const sourceImageBase64 = (
      await sharp({
        create: {
          width: 320,
          height: 320,
          channels: 3,
          background: "#c8a47a"
        }
      })
        .png()
        .toBuffer()
    ).toString("base64");
    const adapter: OpenAIImageAdapter = {
      async generateLayoutBackground() {
        throw new Error("not used in this test");
      },
      async generateConceptRendering(input) {
        calls.push(input);
        return { model: "gpt-image-test", imageBase64: sourceImageBase64 };
      }
    };

    const snapshot = buildSnapshot();
    const result = await generateRound1Rendering({
      snapshot,
      referenceImagesBase64: ["plan-png"],
      renderingPreferences: {
        cabinetStyle: "EUROPEAN_FRAMELESS",
        color: europeanOak
      },
      adapter
    });

    expect(result.model).toBe("gpt-image-test");
    const metadata = await sharp(Buffer.from(result.imageBase64, "base64")).metadata();
    expect(metadata.width).toBe(TARGET_RENDERING_WIDTH);
    expect(metadata.height).toBe(TARGET_RENDERING_HEIGHT);
    expect(result.size).toBe(DEFAULT_RENDERING_SIZE);
    expect(result.salesEstimateOnly).toBe(true);
    expect(result.notForProduction).toBe(true);
    expect(result.dimensionConfidence).toBe("ROUGH");
    expect(result.basedOnSnapshotGeneratedAt).toBe(snapshot.generatedAt);
    expect(result.basedOnRenderingPreferences).toEqual({
      cabinetStyle: "EUROPEAN_FRAMELESS",
      doorColorId: "eu-oak",
      colorUpdatedAt: "2026-06-19T00:00:00.000Z"
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].referenceImagesBase64).toEqual(["plan-png"]);
    expect(calls[0].size).toBe(DEFAULT_RENDERING_SIZE);
    expect(calls[0].prompt).toContain("concept rendering");
    expect(calls[0].prompt).toContain("sales-estimate concept image only");
    expect(calls[0].prompt).toContain("warm natural oak matte slab cabinet doors");
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
        renderingPreferences: {
          cabinetStyle: "EUROPEAN_FRAMELESS",
          color: europeanOak
        },
        adapter
      })
    ).rejects.toThrow();
    expect(generateConceptRendering).not.toHaveBeenCalled();
  });
});
