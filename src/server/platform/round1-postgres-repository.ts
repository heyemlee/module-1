import { randomUUID } from "node:crypto";
import { query } from "@/server/db/client";
import { round1FormSchema, type Round1FormInput } from "@/domain/round1";
import type { Round1Snapshot } from "@/features/round1/snapshot";
import type { PositionOverrides } from "@/features/round1/floorplan/plan-geometry";
import type { Round1RenderingPreferenceStamp } from "@/server/round1/rendering-service";
import type { AuthUser } from "./types";
import {
  buildObjectKey,
  createBucketStorageFromEnv
} from "@/server/storage/bucket";

/**
 * Non-authoritative concept rendering stored alongside a project. Customer-facing
 * preview only — deliberately kept OUT of `Round1Snapshot` (never affects snapshot
 * validity/readiness or any cabinet/dimension/geometry/quote data). Retained so the
 * last preview survives a reload; `basedOnSnapshotGeneratedAt` flags it stale once
 * the snapshot is regenerated.
 */
export type Round1ProjectRendering = {
  model: string;
  imageBase64: string;
  prompt: string;
  size: string;
  basedOnSnapshotGeneratedAt: string;
  basedOnRenderingPreferences: Round1RenderingPreferenceStamp | null;
  salesEstimateOnly: true;
  notForProduction: true;
  dimensionConfidence: "ROUGH";
  createdAt: string;
};

export type Round1State = {
  projectId: string;
  showroomForm: Round1FormInput;
  positionOverrides: PositionOverrides;
  fixedPositionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
  currentStep: number;
  maxAccessibleStep: number;
  updatedAt: string;
};

type Round1StateRow = {
  project_id: string;
  showroom_form_json: unknown;
  position_overrides_json: unknown;
  fixed_positions_confirmed: boolean;
  cabinet_fill_generated: boolean;
  current_step: number;
  max_accessible_step: number;
  updated_at: Date;
};

type RenderingHistoryRow = {
  id: string;
  model: string;
  image_base64: string | null;
  prompt: string;
  size: string;
  based_on_snapshot_generated_at: Date;
  based_on_cabinet_style: Round1RenderingPreferenceStamp["cabinetStyle"] | null;
  based_on_door_color_id: string | null;
  based_on_color_updated_at: Date | null;
  sales_estimate_only: true;
  not_for_production: true;
  dimension_confidence: "ROUGH";
  created_at: Date;
};

export function mapRound1StateRow(row: Round1StateRow): Round1State {
  return {
    projectId: row.project_id,
    showroomForm: round1FormSchema.parse(row.showroom_form_json),
    positionOverrides: row.position_overrides_json as PositionOverrides,
    fixedPositionsConfirmed: row.fixed_positions_confirmed,
    cabinetFillGenerated: row.cabinet_fill_generated,
    currentStep: row.current_step,
    maxAccessibleStep: row.max_accessible_step,
    updatedAt: row.updated_at.toISOString()
  };
}

// Gallery list rows omit `image_base64` (~2.8MB each) — those are streamed on
// demand per image via the rendering image route instead of being inlined.
export type RenderingSummary = Omit<
  Round1ProjectRendering & { id: string },
  "imageBase64"
> & {
  /** Snapshot the image was generated from — what a design-basis lock pins. */
  round1SnapshotId: string;
  /** Open Confirmation Required items on that snapshot, surfaced at lock time. */
  confirmationCount: number;
};

type RenderingSummaryRow = Omit<RenderingHistoryRow, "image_base64"> & {
  round1_snapshot_id: string;
  confirmation_count: number | null;
};

export function mapRenderingSummaryRow(row: RenderingSummaryRow): RenderingSummary {
  return {
    id: row.id,
    round1SnapshotId: row.round1_snapshot_id,
    confirmationCount: row.confirmation_count ?? 0,
    model: row.model,
    prompt: row.prompt,
    size: row.size,
    basedOnSnapshotGeneratedAt: row.based_on_snapshot_generated_at.toISOString(),
    basedOnRenderingPreferences:
      row.based_on_cabinet_style && row.based_on_door_color_id
        ? {
            cabinetStyle: row.based_on_cabinet_style,
            doorColorId: row.based_on_door_color_id,
            colorUpdatedAt: row.based_on_color_updated_at?.toISOString() ?? null
          }
        : null,
    salesEstimateOnly: row.sales_estimate_only,
    notForProduction: row.not_for_production,
    dimensionConfidence: row.dimension_confidence,
    createdAt: row.created_at.toISOString()
  };
}

export function mapRenderingHistoryRow(
  row: RenderingHistoryRow
): Round1ProjectRendering & { id: string } {
  return {
    id: row.id,
    model: row.model,
    imageBase64: row.image_base64 ?? "",
    prompt: row.prompt,
    size: row.size,
    basedOnSnapshotGeneratedAt: row.based_on_snapshot_generated_at.toISOString(),
    basedOnRenderingPreferences:
      row.based_on_cabinet_style && row.based_on_door_color_id
        ? {
            cabinetStyle: row.based_on_cabinet_style,
            doorColorId: row.based_on_door_color_id,
            colorUpdatedAt:
              row.based_on_color_updated_at?.toISOString() ?? null
          }
        : null,
    salesEstimateOnly: row.sales_estimate_only,
    notForProduction: row.not_for_production,
    dimensionConfidence: row.dimension_confidence,
    createdAt: row.created_at.toISOString()
  };
}

export async function getRound1State(projectId: string) {
  const result = await query<Round1StateRow>(
    `SELECT project_id, showroom_form_json, position_overrides_json,
            fixed_positions_confirmed, cabinet_fill_generated,
            current_step, max_accessible_step, updated_at
     FROM round1_states WHERE project_id = $1`,
    [projectId]
  );
  const row = result.rows[0];
  return row ? mapRound1StateRow(row) : null;
}

export async function saveRound1State(input: {
  projectId: string;
  user: AuthUser;
  showroomForm: Round1FormInput;
  positionOverrides: PositionOverrides;
  fixedPositionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
  currentStep?: number;
  maxAccessibleStep?: number;
}) {
  const currentStep = input.currentStep ?? 0;
  const maxAccessibleStep = input.maxAccessibleStep ?? currentStep;
  const result = await query<Round1StateRow>(
    `INSERT INTO round1_states (
       project_id, showroom_form_json, position_overrides_json,
       fixed_positions_confirmed, cabinet_fill_generated,
       current_step, max_accessible_step, updated_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (project_id) DO UPDATE SET
       showroom_form_json = EXCLUDED.showroom_form_json,
       position_overrides_json = EXCLUDED.position_overrides_json,
       fixed_positions_confirmed = EXCLUDED.fixed_positions_confirmed,
       cabinet_fill_generated = EXCLUDED.cabinet_fill_generated,
       current_step = EXCLUDED.current_step,
       max_accessible_step = EXCLUDED.max_accessible_step,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = now()
     RETURNING project_id, showroom_form_json, position_overrides_json,
               fixed_positions_confirmed, cabinet_fill_generated,
               current_step, max_accessible_step, updated_at`,
    [
      input.projectId,
      JSON.stringify(input.showroomForm),
      JSON.stringify(input.positionOverrides),
      input.fixedPositionsConfirmed,
      input.cabinetFillGenerated,
      currentStep,
      maxAccessibleStep,
      input.user.id
    ]
  );
  return mapRound1StateRow(result.rows[0]);
}

export async function saveRound1Snapshot(input: {
  projectId: string;
  user: AuthUser;
  snapshot: Round1Snapshot;
}) {
  const result = await query<{ id: string }>(
    `INSERT INTO round1_snapshots (project_id, snapshot_json, generated_at, generated_by_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.projectId, JSON.stringify(input.snapshot), input.snapshot.generatedAt, input.user.id]
  );
  // Once a design basis is locked the project lives in the technical-design
  // phase; renewed Round 1 exploration must not regress it (the basis, not the
  // latest snapshot, is what Round 2 reads).
  await query(
    `UPDATE projects SET status = 'INTAKE', updated_at = now()
     WHERE id = $1 AND status NOT IN ('ROUND2_MEASURING', 'ARCHIVED')`,
    [input.projectId]
  );
  return result.rows[0].id;
}

export async function getLatestRound1Snapshot(projectId: string) {
  const result = await query<{ id: string; snapshot_json: unknown }>(
    `SELECT id, snapshot_json
     FROM round1_snapshots
     WHERE project_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId]
  );
  const row = result.rows[0];
  return row ? { id: row.id, snapshot: row.snapshot_json as Round1Snapshot } : null;
}

export async function saveRenderingHistory(input: {
  projectId: string;
  snapshotId: string;
  user: AuthUser;
  rendering: Omit<Round1ProjectRendering, "createdAt">;
}) {
  const basedOnRenderingPreferences =
    input.rendering.basedOnRenderingPreferences;
  if (!basedOnRenderingPreferences) {
    throw new Error("Rendering preference metadata is required");
  }

  const storage = createBucketStorageFromEnv(process.env);
  const renderingId = randomUUID();
  const imageBuffer = Buffer.from(input.rendering.imageBase64, "base64");
  const imageObjectKey = storage
    ? buildObjectKey("renderings", input.projectId, `${renderingId}.png`)
    : null;

  if (storage && imageObjectKey) {
    await storage.uploadObject(imageObjectKey, imageBuffer, "image/png");
  }

  const result = await query<{ id: string; created_at: Date }>(
    `INSERT INTO renderings (
       id, project_id, round1_snapshot_id, model, image_base64,
       image_object_key, image_content_type, image_bytes, prompt, size,
       based_on_snapshot_generated_at, based_on_cabinet_style,
       based_on_door_color_id, based_on_color_updated_at, sales_estimate_only,
       not_for_production, dimension_confidence, created_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, true, 'ROUGH', $15)
     RETURNING id, created_at`,
    [
      renderingId,
      input.projectId,
      input.snapshotId,
      input.rendering.model,
      storage ? null : input.rendering.imageBase64,
      imageObjectKey,
      storage ? "image/png" : null,
      storage ? imageBuffer.length : null,
      input.rendering.prompt,
      input.rendering.size,
      input.rendering.basedOnSnapshotGeneratedAt,
      basedOnRenderingPreferences.cabinetStyle,
      basedOnRenderingPreferences.doorColorId,
      basedOnRenderingPreferences.colorUpdatedAt,
      input.user.id
    ]
  );
  await query(
    `UPDATE projects SET status = 'RENDERING_READY', updated_at = now()
     WHERE id = $1 AND status NOT IN ('ROUND2_MEASURING', 'ARCHIVED')`,
    [input.projectId]
  );
  return {
    ...input.rendering,
    id: result.rows[0].id,
    createdAt: result.rows[0].created_at.toISOString()
  };
}

export async function listRenderings(projectId: string): Promise<RenderingSummary[]> {
  const result = await query<RenderingSummaryRow>(
    `SELECT r.id, r.model, r.prompt, r.size, r.round1_snapshot_id,
            r.based_on_snapshot_generated_at, r.based_on_cabinet_style,
            r.based_on_door_color_id, r.based_on_color_updated_at,
            r.sales_estimate_only, r.not_for_production, r.dimension_confidence,
            r.created_at,
            COALESCE(jsonb_array_length(s.snapshot_json->'confirmationItems'), 0)
              AS confirmation_count
     FROM renderings r
     JOIN round1_snapshots s ON s.id = r.round1_snapshot_id
     WHERE r.project_id = $1
     ORDER BY r.created_at DESC
     LIMIT 20`,
    [projectId]
  );
  return result.rows.map(mapRenderingSummaryRow);
}

export async function getRound1SnapshotById(projectId: string, snapshotId: string) {
  const result = await query<{ id: string; snapshot_json: unknown }>(
    `SELECT id, snapshot_json
     FROM round1_snapshots
     WHERE id = $1 AND project_id = $2
     LIMIT 1`,
    [snapshotId, projectId]
  );
  const row = result.rows[0];
  return row ? { id: row.id, snapshot: row.snapshot_json as Round1Snapshot } : null;
}

/**
 * Fetch a single rendering's PNG bytes by id, scoped to its project. Returns
 * null when the rendering does not exist (or belongs to another project) so the
 * caller can answer 404 without leaking other projects' images.
 */
export async function getRenderingImage(projectId: string, renderingId: string) {
  const result = await query<{ image_object_key: string | null; image_base64: string | null }>(
    `SELECT image_object_key, image_base64
     FROM renderings WHERE id = $1 AND project_id = $2 LIMIT 1`,
    [renderingId, projectId]
  );
  const row = result.rows[0];
  if (!row) return null;

  if (row.image_object_key) {
    const storage = createBucketStorageFromEnv(process.env);
    if (storage) {
      try {
        return (await storage.getObject(row.image_object_key)).body;
      } catch (error) {
        if (!row.image_base64) throw error;
      }
    }
  }

  return row.image_base64 ? Buffer.from(row.image_base64, "base64") : null;
}

export async function getRenderCountForCurrentMonth(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT count(*) FROM renderings WHERE created_by_user_id = $1 AND created_at >= date_trunc('month', current_date)`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}
