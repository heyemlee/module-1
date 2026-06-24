import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// Mirror src/server/db/client.ts resolveSsl so prod migrations encrypt the wire.
// The Railway proxy presents a self-signed cert, so DATABASE_SSL_NO_VERIFY=true
// relaxes verification while still using TLS. Default (no flag, not prod) stays
// plaintext for local DBs. An explicit sslmode in the URL drives SSL itself.
function resolveSsl(connectionString) {
  if (/[?&]sslmode=/.test(connectionString)) return undefined;
  if (process.env.NODE_ENV !== "production" && process.env.DATABASE_SSL_NO_VERIFY !== "true") {
    return undefined;
  }
  return { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== "true" };
}

const connectionString = process.env.DATABASE_URL;
const schema = await readFile(join(process.cwd(), "src/server/db/schema.sql"), "utf8");
const pool = new Pool({ connectionString, ssl: resolveSsl(connectionString) });

try {
  await pool.query(schema);
} finally {
  await pool.end();
}

console.log("Database migration complete");
