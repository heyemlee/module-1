import { query } from "@/server/db/client";
import { round1FormSchema, type Round1FormInput } from "@/domain/round1";
import type { Round1Snapshot } from "@/features/round1/snapshot";
import type { PositionOverrides } from "@/features/round1/floorplan/plan-geometry";
import type { Round1ProjectRendering } from "@/server/round1/round1-repository";
import type { AuthUser } from "./types";

export type Round1State = {
  projectId: string;
  showroomForm: Round1FormInput;
  positionOverrides: PositionOverrides;
  fixedPositionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
  updatedAt: string;
};

type Round1StateRow = {
  project_id: string;
  showroom_form_json: unknown;
  position_overrides_json: unknown;
  fixed_positions_confirmed: boolean;
  cabinet_fill_generated: boolean;
  updated_at: Date;
};

export function mapRound1StateRow(row: Round1StateRow): Round1State {
  return {
    projectId: row.project_id,
    showroomForm: round1FormSchema.parse(row.showroom_form_json),
    positionOverrides: row.position_overrides_json as PositionOverrides,
    fixedPositionsConfirmed: row.fixed_positions_confirmed,
    cabinetFillGenerated: row.cabinet_fill_generated,
    updatedAt: row.updated_at.toISOString()
  };
}

export async function getRound1State(projectId: string) {
  const result = await query<Round1StateRow>(
    `SELECT project_id, showroom_form_json, position_overrides_json,
            fixed_positions_confirmed, cabinet_fill_generated, updated_at
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
}) {
  const result = await query<Round1StateRow>(
    `INSERT INTO round1_states (
       project_id, showroom_form_json, position_overrides_json,
       fixed_positions_confirmed, cabinet_fill_generated, updated_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (project_id) DO UPDATE SET
       showroom_form_json = EXCLUDED.showroom_form_json,
       position_overrides_json = EXCLUDED.position_overrides_json,
       fixed_positions_confirmed = EXCLUDED.fixed_positions_confirmed,
       cabinet_fill_generated = EXCLUDED.cabinet_fill_generated,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = now()
     RETURNING project_id, showroom_form_json, position_overrides_json,
               fixed_positions_confirmed, cabinet_fill_generated, updated_at`,
    [
      input.projectId,
      JSON.stringify(input.showroomForm),
      JSON.stringify(input.positionOverrides),
      input.fixedPositionsConfirmed,
      input.cabinetFillGenerated,
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
  await query(
    `UPDATE projects SET status = 'ROUND1_SNAPSHOT_READY', updated_at = now() WHERE id = $1`,
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
  const result = await query<{ id: string; created_at: Date }>(
    `INSERT INTO renderings (
       project_id, round1_snapshot_id, model, image_base64, prompt, size,
       based_on_snapshot_generated_at, sales_estimate_only, not_for_production,
       dimension_confidence, created_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, 'ROUGH', $8)
     RETURNING id, created_at`,
    [
      input.projectId,
      input.snapshotId,
      input.rendering.model,
      input.rendering.imageBase64,
      input.rendering.prompt,
      input.rendering.size,
      input.rendering.basedOnSnapshotGeneratedAt,
      input.user.id
    ]
  );
  await query(
    `UPDATE projects SET status = 'ROUND1_RENDERING_READY', updated_at = now() WHERE id = $1`,
    [input.projectId]
  );
  return {
    ...input.rendering,
    id: result.rows[0].id,
    createdAt: result.rows[0].created_at.toISOString()
  };
}

export async function listRenderings(projectId: string) {
  const result = await query<{ id: string; image_base64: string; created_at: Date }>(
    `SELECT id, image_base64, created_at
     FROM renderings
     WHERE project_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [projectId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    imageBase64: row.image_base64,
    createdAt: row.created_at.toISOString()
  }));
}
