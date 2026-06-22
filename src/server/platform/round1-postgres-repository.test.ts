import { afterEach, describe, expect, test, vi } from "vitest";
import { query } from "@/server/db/client";
import { createDefaultShowroomForm } from "@/features/round1/showroom-intake-data";
import {
  mapRenderingHistoryRow,
  mapRound1StateRow,
  saveRenderingHistory
} from "./round1-postgres-repository";

vi.mock("@/server/db/client", () => ({
  query: vi.fn()
}));

afterEach(() => {
  vi.mocked(query).mockReset();
});

describe("round1 postgres mappers", () => {
  test("maps editable Round 1 state from json rows", () => {
    // The stored form is validated through round1FormSchema on read, so the
    // fixture uses a full default form (a partial object would fail parsing).
    const showroomFormJson = JSON.parse(JSON.stringify(createDefaultShowroomForm()));
    const state = mapRound1StateRow({
      project_id: "p1",
      showroom_form_json: showroomFormJson,
      position_overrides_json: { sink: { wall: "TOP", center: 40 } },
      fixed_positions_confirmed: true,
      cabinet_fill_generated: false,
      updated_at: new Date("2026-06-19T00:00:00.000Z")
    });
    expect(state.projectId).toBe("p1");
    expect(state.positionOverrides).toEqual({ sink: { wall: "TOP", center: 40 } });
    expect(state.fixedPositionsConfirmed).toBe(true);
  });

  test("maps rendering preference metadata from history rows", () => {
    const rendering = mapRenderingHistoryRow({
      id: "r1",
      model: "gpt-image-test",
      image_base64: "rendered",
      prompt: "concept prompt",
      size: "1536x1024",
      based_on_snapshot_generated_at: new Date("2026-06-18T00:00:00.000Z"),
      based_on_cabinet_style: "EUROPEAN_FRAMELESS",
      based_on_door_color_id: "eu-oak",
      based_on_color_updated_at: new Date("2026-06-19T00:00:00.000Z"),
      sales_estimate_only: true,
      not_for_production: true,
      dimension_confidence: "ROUGH",
      created_at: new Date("2026-06-20T00:00:00.000Z")
    });

    expect(rendering.basedOnRenderingPreferences).toEqual({
      cabinetStyle: "EUROPEAN_FRAMELESS",
      doorColorId: "eu-oak",
      colorUpdatedAt: "2026-06-19T00:00:00.000Z"
    });
  });

  test("does not invent rendering preference metadata for legacy history rows", () => {
    const rendering = mapRenderingHistoryRow({
      id: "r1",
      model: "gpt-image-test",
      image_base64: "rendered",
      prompt: "concept prompt",
      size: "1536x1024",
      based_on_snapshot_generated_at: new Date("2026-06-18T00:00:00.000Z"),
      based_on_cabinet_style: null,
      based_on_door_color_id: null,
      based_on_color_updated_at: null,
      sales_estimate_only: true,
      not_for_production: true,
      dimension_confidence: "ROUGH",
      created_at: new Date("2026-06-20T00:00:00.000Z")
    });

    expect(rendering.basedOnRenderingPreferences).toBeNull();
  });

  test("persists rendering preference metadata with rendering history", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "rendering-1",
            created_at: new Date("2026-06-20T00:00:00.000Z")
          }
        ]
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await saveRenderingHistory({
      projectId: "project-1",
      snapshotId: "snapshot-1",
      user: {
        id: "user-1",
        companyId: "company-1",
        email: "ada@example.com",
        name: "Ada",
        role: "SALES",
        disabledAt: null
      },
      rendering: {
        model: "gpt-image-test",
        imageBase64: "rendered",
        prompt: "concept prompt",
        size: "1536x1024",
        basedOnSnapshotGeneratedAt: "2026-06-18T00:00:00.000Z",
        basedOnRenderingPreferences: {
          cabinetStyle: "EUROPEAN_FRAMELESS",
          doorColorId: "eu-oak",
          colorUpdatedAt: "2026-06-19T00:00:00.000Z"
        },
        salesEstimateOnly: true,
        notForProduction: true,
        dimensionConfidence: "ROUGH"
      }
    });

    expect(vi.mocked(query).mock.calls[0][0]).toContain(
      "based_on_cabinet_style"
    );
    expect(vi.mocked(query).mock.calls[0][1]).toEqual([
      "project-1",
      "snapshot-1",
      "gpt-image-test",
      "rendered",
      "concept prompt",
      "1536x1024",
      "2026-06-18T00:00:00.000Z",
      "EUROPEAN_FRAMELESS",
      "eu-oak",
      "2026-06-19T00:00:00.000Z",
      "user-1"
    ]);
  });
});
