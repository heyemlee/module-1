import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== "true" },
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000
});

try {
  const [renderings, cabinetColors, candidates] = await Promise.all([
    pool.query(`
      SELECT count(*)::int AS total,
             count(image_object_key)::int AS migrated,
             count(*) FILTER (WHERE image_object_key IS NULL)::int AS remaining
      FROM renderings`),
    pool.query(`
      SELECT count(*)::int AS total,
             count(swatch_object_key)::int AS swatch_migrated,
             count(hover_object_key)::int AS hover_migrated
      FROM cabinet_colors`),
    pool.query(`
      WITH unreferenced AS (
        SELECT r.id, r.project_id, r.created_at,
               row_number() OVER (PARTITION BY r.project_id ORDER BY r.created_at DESC) AS position
        FROM renderings r
        LEFT JOIN design_basis b ON b.rendering_id = r.id
        WHERE b.id IS NULL
      )
      SELECT id, project_id, created_at
      FROM unreferenced
      WHERE position > 5
      ORDER BY project_id, created_at ASC`)
  ]);

  console.log(JSON.stringify({
    renderings: renderings.rows[0],
    cabinetColors: cabinetColors.rows[0],
    unreferencedRenderingCandidates: candidates.rows
  }, null, 2));
} finally {
  await pool.end();
}
