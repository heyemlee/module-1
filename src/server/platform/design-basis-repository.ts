import { query } from "@/server/db/client";
import type { AuthUser } from "./types";

/**
 * The design basis is the customer-confirmed Round 1 package: the rendering the
 * customer approved plus the snapshot/style/color it was generated from. It is
 * the only Round 1 data technical design (Round 2) reads — never "the latest
 * snapshot", which may have drifted after the customer confirmed. Append-only:
 * relocking inserts version+1 and downstream drafts reconcile against the
 * version they were built on.
 */
export type DesignBasis = {
  id: string;
  projectId: string;
  version: number;
  renderingId: string;
  round1SnapshotId: string;
  cabinetStyle: "EUROPEAN_FRAMELESS" | "AMERICAN_FRAMED";
  doorColorId: string;
  lockedByUserId: string;
  lockedAt: string;
};

type DesignBasisRow = {
  id: string;
  project_id: string;
  version: number;
  rendering_id: string;
  round1_snapshot_id: string;
  cabinet_style: DesignBasis["cabinetStyle"];
  door_color_id: string;
  locked_by_user_id: string;
  locked_at: Date;
};

function mapDesignBasisRow(row: DesignBasisRow): DesignBasis {
  return {
    id: row.id,
    projectId: row.project_id,
    version: row.version,
    renderingId: row.rendering_id,
    round1SnapshotId: row.round1_snapshot_id,
    cabinetStyle: row.cabinet_style,
    doorColorId: row.door_color_id,
    lockedByUserId: row.locked_by_user_id,
    lockedAt: row.locked_at.toISOString()
  };
}

export async function getCurrentDesignBasis(
  projectId: string
): Promise<DesignBasis | null> {
  const result = await query<DesignBasisRow>(
    `SELECT id, project_id, version, rendering_id, round1_snapshot_id,
            cabinet_style, door_color_id, locked_by_user_id, locked_at
     FROM design_basis
     WHERE project_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [projectId]
  );
  const row = result.rows[0];
  return row ? mapDesignBasisRow(row) : null;
}

export type LockDesignBasisError =
  | "RENDERING_NOT_FOUND"
  | "MISSING_PREFERENCES";

/**
 * Locks a rendering as the project's design basis. The snapshot/style/color are
 * read from the rendering row server-side — the client only names the rendering,
 * so the basis always matches what the customer actually saw. Renderings saved
 * before preference stamping carry no color and cannot anchor a BOM, hence
 * MISSING_PREFERENCES.
 */
export async function lockDesignBasis(input: {
  projectId: string;
  renderingId: string;
  user: AuthUser;
}): Promise<DesignBasis | LockDesignBasisError> {
  const rendering = await query<{
    round1_snapshot_id: string;
    based_on_cabinet_style: DesignBasis["cabinetStyle"] | null;
    based_on_door_color_id: string | null;
  }>(
    `SELECT round1_snapshot_id, based_on_cabinet_style, based_on_door_color_id
     FROM renderings
     WHERE id = $1 AND project_id = $2
     LIMIT 1`,
    [input.renderingId, input.projectId]
  );
  const row = rendering.rows[0];
  if (!row) return "RENDERING_NOT_FOUND";
  if (!row.based_on_cabinet_style || !row.based_on_door_color_id) {
    return "MISSING_PREFERENCES";
  }

  const inserted = await query<DesignBasisRow>(
    `INSERT INTO design_basis (
       project_id, version, rendering_id, round1_snapshot_id,
       cabinet_style, door_color_id, locked_by_user_id
     )
     SELECT $1,
            COALESCE((SELECT MAX(version) FROM design_basis WHERE project_id = $1), 0) + 1,
            $2, $3, $4, $5, $6
     RETURNING id, project_id, version, rendering_id, round1_snapshot_id,
               cabinet_style, door_color_id, locked_by_user_id, locked_at`,
    [
      input.projectId,
      input.renderingId,
      row.round1_snapshot_id,
      row.based_on_cabinet_style,
      row.based_on_door_color_id,
      input.user.id
    ]
  );

  // A locked basis means the project has entered the technical-design phase.
  await query(
    `UPDATE projects SET status = 'ROUND2_MEASURING', updated_at = now()
     WHERE id = $1 AND status <> 'ARCHIVED'`,
    [input.projectId]
  );

  return mapDesignBasisRow(inserted.rows[0]);
}
