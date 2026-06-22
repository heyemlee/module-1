// Phase B — Seed the in-stock cabinet colors into a database (idempotent).
//
//   DATABASE_URL="postgresql://…@…proxy.rlwy.net:PORT/railway" \
//     node scripts/seed-cabinet-colors.mjs
//
// Options (env):
//   DRY_RUN=1            Report planned create/update actions without writing.
//   SEED_COMPANY_NAME    Target company by name. Default: auto-detect (prefers
//                        "ABC Cabinet"; else the single company if exactly one exists).
//   COLORS_FILE          Manifest path. Default: scripts/cabinet-colors-eu.json.
//
// Upserts are keyed on (company_id, cabinet_style, name), so re-runs refresh the
// swatch/prompt/sort_order in place and never create duplicates. Mirrors the raw-pg,
// idempotent style of scripts/seed-admin.mjs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const dryRun = Boolean(process.env.DRY_RUN);
const colorsFileArg = process.env.COLORS_FILE || "scripts/cabinet-colors-eu.json";
const colorsFile = isAbsolute(colorsFileArg) ? colorsFileArg : join(repoRoot, colorsFileArg);

const colors = JSON.parse(readFileSync(colorsFile, "utf8"));
if (!Array.isArray(colors) || colors.length === 0) {
  throw new Error(`No colors found in ${colorsFile}`);
}
for (const c of colors) {
  if (!c.name || !c.cabinetStyle || !c.promptDescription) {
    throw new Error(`Invalid color entry (needs name/cabinetStyle/promptDescription): ${JSON.stringify(c.name)}`);
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resolveCompanyId() {
  const { rows } = await pool.query(`SELECT id, name FROM companies ORDER BY created_at`);
  if (rows.length === 0) throw new Error("No companies exist in this database.");

  const wanted = process.env.SEED_COMPANY_NAME;
  if (wanted) {
    const match = rows.find((r) => r.name === wanted);
    if (!match) {
      throw new Error(
        `Company "${wanted}" not found. Available: ${rows.map((r) => r.name).join(", ")}`
      );
    }
    return match;
  }

  const abc = rows.find((r) => r.name === "ABC Cabinet");
  if (abc) return abc;
  if (rows.length === 1) return rows[0];
  throw new Error(
    `Multiple companies found; set SEED_COMPANY_NAME to one of: ${rows.map((r) => r.name).join(", ")}`
  );
}

const company = await resolveCompanyId();

const existing = await pool.query(
  `SELECT cabinet_style, count(*)::int AS n FROM cabinet_colors
   WHERE company_id = $1 GROUP BY cabinet_style`,
  [company.id]
);
console.log(`Company: ${company.name} (${company.id})`);
console.log(
  `Existing cabinet_colors: ${
    existing.rows.map((r) => `${r.cabinet_style}=${r.n}`).join(", ") || "none"
  }`
);
console.log(`Manifest: ${colors.length} colors from ${colorsFile}`);
console.log(dryRun ? "Mode: DRY RUN (no writes)\n" : "Mode: WRITE\n");

let created = 0;
let updated = 0;

for (const color of colors) {
  const found = await pool.query(
    `SELECT id FROM cabinet_colors
     WHERE company_id = $1 AND cabinet_style = $2 AND name = $3
     LIMIT 1`,
    [company.id, color.cabinetStyle, color.name]
  );
  const action = found.rows[0] ? "update" : "create";
  if (action === "create") created += 1;
  else updated += 1;

  console.log(`  [${action}] ${color.name}`);
  if (dryRun) continue;

  if (found.rows[0]) {
    await pool.query(
      `UPDATE cabinet_colors SET
         swatch_image_url = $2,
         swatch_hex = $3,
         hover_example_image_url = NULL,
         prompt_description = $4,
         active = true,
         sort_order = $5,
         updated_at = now()
       WHERE id = $1`,
      [found.rows[0].id, color.swatchImageUrl ?? null, color.swatchHex ?? null, color.promptDescription, color.sortOrder ?? 0]
    );
  } else {
    await pool.query(
      `INSERT INTO cabinet_colors (
         company_id, cabinet_style, name, color_code, swatch_image_url,
         swatch_hex, hover_example_image_url, prompt_description, active, sort_order
       )
       VALUES ($1, $2, $3, NULL, $4, $5, NULL, $6, true, $7)`,
      [
        company.id,
        color.cabinetStyle,
        color.name,
        color.swatchImageUrl ?? null,
        color.swatchHex ?? null,
        color.promptDescription,
        color.sortOrder ?? 0
      ]
    );
  }
}

await pool.end();
console.log(
  `\n${dryRun ? "[DRY RUN] Would create" : "Created"} ${created}, ${
    dryRun ? "would update" : "updated"
  } ${updated} (total ${colors.length}).`
);
