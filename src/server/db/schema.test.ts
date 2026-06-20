import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const schema = readFileSync(join(process.cwd(), "src/server/db/schema.sql"), "utf8");

describe("Postgres schema", () => {
  test("defines the internal platform tables", () => {
    for (const table of [
      "companies",
      "users",
      "sessions",
      "customers",
      "projects",
      "round1_states",
      "round1_snapshots",
      "renderings"
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  test("keeps company_id on tenant-owned rows", () => {
    expect(schema).toContain("company_id UUID NOT NULL REFERENCES companies(id)");
    expect(schema).toContain("role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SALES', 'DESIGNER'))");
  });

  test("defines cabinet color library and rendering preference metadata", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS cabinet_colors");
    expect(schema).toContain("cabinet_style TEXT NOT NULL CHECK (cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED'))");
    expect(schema).toContain("swatch_image_url TEXT");
    expect(schema).toContain("hover_example_image_url TEXT");
    expect(schema).toContain("prompt_description TEXT NOT NULL");
    expect(schema).toContain("based_on_cabinet_style TEXT");
    expect(schema).toContain("based_on_door_color_id UUID");
  });

  test("migrates rendering preference metadata onto existing tables", () => {
    expect(schema).toContain(
      "ALTER TABLE renderings ADD COLUMN IF NOT EXISTS based_on_cabinet_style TEXT CHECK (based_on_cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED'))"
    );
    expect(schema).toContain(
      "ALTER TABLE renderings ADD COLUMN IF NOT EXISTS based_on_door_color_id UUID"
    );
    expect(schema).toContain(
      "ALTER TABLE renderings ADD COLUMN IF NOT EXISTS based_on_color_updated_at TIMESTAMPTZ"
    );
  });
});
