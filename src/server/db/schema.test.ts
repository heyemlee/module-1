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
});
