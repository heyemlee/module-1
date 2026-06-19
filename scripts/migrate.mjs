import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const schema = await readFile(join(process.cwd(), "src/server/db/schema.sql"), "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(schema);
} finally {
  await pool.end();
}

console.log("Database migration complete");
