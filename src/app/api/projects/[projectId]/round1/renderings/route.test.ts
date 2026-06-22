import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  adapter: { generateConceptRendering: vi.fn() },
  requireUser: vi.fn(),
  getProjectForUser: vi.fn(),
  getRound1State: vi.fn(),
  getCabinetColor: vi.fn(),
  getLatestRound1Snapshot: vi.fn(),
  saveRenderingHistory: vi.fn(),
  generateRound1Rendering: vi.fn(),
  createOpenAIImageAdapterFromEnv: vi.fn()
}));

vi.mock("@/server/platform/auth-service", () => ({
  requireUser: mocks.requireUser
}));

vi.mock("@/server/platform/project-repository", () => ({
  getProjectForUser: mocks.getProjectForUser
}));

vi.mock("@/server/platform/cabinet-color-repository", () => ({
  getCabinetColor: mocks.getCabinetColor,
  isColorCompatibleWithStyle: (
    color: CabinetColor | null,
    cabinetStyle: CabinetStyle
  ) => Boolean(color && color.active && color.cabinetStyle === cabinetStyle)
}));

vi.mock("@/server/platform/round1-postgres-repository", () => ({
  getLatestRound1Snapshot: mocks.getLatestRound1Snapshot,
  getRound1State: mocks.getRound1State,
  listRenderings: vi.fn(),
  saveRenderingHistory: mocks.saveRenderingHistory
}));

vi.mock("@/server/round1/rendering-service", () => ({
  generateRound1Rendering: mocks.generateRound1Rendering
}));

vi.mock("@/infrastructure/image/openai-rest-image-client", () => ({
  createOpenAIImageAdapterFromEnv: mocks.createOpenAIImageAdapterFromEnv
}));

const user = {
  id: "user-1",
  companyId: "company-1",
  email: "ada@example.com",
  name: "Ada",
  role: "SALES",
  disabledAt: null
};

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

function request() {
  return POST(
    new Request("http://localhost/api/projects/project-1/round1/renderings", {
      method: "POST",
      body: JSON.stringify({ referenceImagesBase64: ["plan"] })
    }),
    { params: Promise.resolve({ projectId: "project-1" }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(user);
  mocks.getProjectForUser.mockResolvedValue({ id: "project-1" });
  mocks.getRound1State.mockResolvedValue({
    showroomForm: {
      renderingPreferences: {
        cabinetStyle: "EUROPEAN_FRAMELESS",
        doorColorId: "eu-oak"
      }
    }
  });
  mocks.getCabinetColor.mockResolvedValue(europeanOak);
  mocks.getLatestRound1Snapshot.mockResolvedValue({
    id: "snapshot-1",
    snapshot: { generatedAt: "2026-06-17T00:00:00.000Z" }
  });
  mocks.createOpenAIImageAdapterFromEnv.mockReturnValue(mocks.adapter);
  mocks.generateRound1Rendering.mockResolvedValue({
    model: "gpt-image-test",
    imageBase64: "rendered",
    prompt: "prompt",
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
  mocks.saveRenderingHistory.mockResolvedValue({ id: "rendering-1" });
});

describe("POST /api/projects/[projectId]/round1/renderings", () => {
  test("returns DOOR_COLOR_REQUIRED when Round 1 state has no selected door color", async () => {
    mocks.getRound1State.mockResolvedValue({
      showroomForm: {
        renderingPreferences: {
          cabinetStyle: "EUROPEAN_FRAMELESS",
          doorColorId: null
        }
      }
    });

    const response = await request();
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.reason).toBe("DOOR_COLOR_REQUIRED");
    expect(mocks.generateRound1Rendering).not.toHaveBeenCalled();
  });

  test.each([
    ["missing", null],
    ["inactive", { ...europeanOak, active: false }],
    ["incompatible", { ...europeanOak, cabinetStyle: "AMERICAN_FRAMED" }]
  ])("returns INVALID_DOOR_COLOR when the selected color is %s", async (_label, color) => {
    mocks.getCabinetColor.mockResolvedValue(color);

    const response = await request();
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.reason).toBe("INVALID_DOOR_COLOR");
    expect(mocks.generateRound1Rendering).not.toHaveBeenCalled();
  });

  test("passes selected rendering preferences to concept generation", async () => {
    const response = await request();

    expect(response.status).toBe(200);
    expect(mocks.generateRound1Rendering).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImagesBase64: ["plan"],
        renderingPreferences: {
          cabinetStyle: "EUROPEAN_FRAMELESS",
          color: europeanOak
        }
      })
    );
    expect(mocks.saveRenderingHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        snapshotId: "snapshot-1"
      })
    );
  });
});
